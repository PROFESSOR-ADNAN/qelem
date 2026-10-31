import { Job } from 'bullmq';
import { Types } from 'mongoose';
import { Notification } from '../../../server/src/models/Notification.js';
import { NotificationPref } from '../../../server/src/models/NotificationPref.js';
import { Block } from '../../../server/src/models/Block.js';
import { Mute } from '../../../server/src/models/Mute.js';
import { redis, redisPub } from '../../../server/src/config/redis.js';
import { logger } from '../../../server/src/utils/logger.js';
import { NotificationType, NotificationTargetType, SYSTEM_LIMITS } from '@qelem/shared';
import { emailQueue } from '../../../server/src/services/queue.service.js';

export interface NotificationJobData {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  targetType: NotificationTargetType;
  targetId: string;
}

export async function processNotificationJob(job: Job<NotificationJobData>): Promise<void> {
  const { recipientId, actorId, type, targetType, targetId } = job.data;

  // Never notify self
  if (recipientId === actorId) return;

  const recipientObjId = new Types.ObjectId(recipientId);
  const actorObjId = new Types.ObjectId(actorId);
  const targetObjId = new Types.ObjectId(targetId);

  // Check if blocked or muted
  const [isBlocked, isMuted] = await Promise.all([
    Block.findOne({
      $or: [
        { blockerId: recipientObjId, blockedId: actorObjId },
        { blockerId: actorObjId, blockedId: recipientObjId }
      ]
    }),
    Mute.findOne({ muterId: recipientObjId, mutedId: actorObjId })
  ]);

  if (isBlocked || isMuted) {
    return; // Blocked or muted actors never notify
  }

  const groupKey = `${type}:${targetType}:${targetId}`;

  // Execute race-safe aggregation using the Partial Unique Index on (userId, groupKey) where readAt: null
  let notificationDoc: any = null;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      notificationDoc = await Notification.findOneAndUpdate(
        { userId: recipientObjId, groupKey, readAt: null },
        {
          $addToSet: { actorIds: actorObjId },
          $inc: { actorCount: 1 },
          $set: { updatedAt: new Date(), seenAt: null, targetType, targetId: targetObjId, type }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      break;
    } catch (err: unknown) {
      // E11000 race condition: another concurrent worker inserted the group doc just before us.
      // Retry immediately as an update.
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: number }).code === 11000) {
        if (attempt === maxRetries) {
          logger.error({ msg: 'Exhausted retries on notification partial unique index collision', groupKey });
          return;
        }
        continue;
      }
      throw err;
    }
  }

  // Increment unread count in Redis
  const unreadCount = await redis.incr(`unread:${recipientId}`);

  // Broadcast to Redis Pub/Sub for live SSE connected clients
  await redisPub.publish(
    `stream:user:${recipientId}`,
    JSON.stringify({
      type: 'unread',
      count: unreadCount,
      notification: {
        id: notificationDoc._id,
        type,
        actorCount: notificationDoc.actorCount,
        updatedAt: notificationDoc.updatedAt
      }
    })
  );

  // Check Email Preferences and enqueue grace-delay email if opted in
  const pref = await NotificationPref.findOne({ userId: recipientObjId });
  const emailAllowed =
    (type === 'mention' && (pref ? pref.emailMentions : true)) ||
    (type === 'reply' && (pref ? pref.emailComments : true));

  if (emailAllowed) {
    // 10-minute grace delay: if user reads in-app during this window, email is dropped
    const delayMs = SYSTEM_LIMITS.EMAIL_MENTION_REPLY_GRACE_MINUTES * 60 * 1000;
    await emailQueue.add(
      'send-grace-notification-email',
      {
        recipientId,
        actorId,
        type,
        notificationId: notificationDoc._id.toString()
      },
      { delay: delayMs, attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
    );
  }
}
