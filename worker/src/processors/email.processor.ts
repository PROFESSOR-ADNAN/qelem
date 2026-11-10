import { Job } from 'bullmq';
import nodemailer from 'nodemailer';
import { Types } from 'mongoose';
import { env } from '../../../server/src/config/env.js';
import { redis } from '../../../server/src/config/redis.js';
import { User } from '../../../server/src/models/User.js';
import { Notification } from '../../../server/src/models/Notification.js';
import { EmailLog } from '../../../server/src/models/EmailLog.js';
import { EmailSuppression } from '../../../server/src/models/EmailSuppression.js';
import { logger } from '../../../server/src/utils/logger.js';
import { SYSTEM_LIMITS } from '@qelem/shared';

// Create Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined
});

function getTodayQuotaKey(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `email:quota:${today}`;
}

export async function checkAndIncrementQuota(): Promise<boolean> {
  const key = getTodayQuotaKey();
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, 48 * 60 * 60); // 48-hour expiration
  }

  if (current > SYSTEM_LIMITS.EMAIL_DAILY_BUDGET_LIMIT) {
    logger.warn({
      msg: 'Daily email provider quota ceiling reached; throttling non-critical emails',
      current,
      budget: SYSTEM_LIMITS.EMAIL_DAILY_BUDGET_LIMIT
    });
    return false;
  }
  return true;
}

export async function processEmailJob(job: Job<any>): Promise<void> {
  const { recipientId, to, type, notificationId, subject, htmlBody } = job.data;
  let user = recipientId ? await User.findById(recipientId) : null;
  const targetEmail = to || user?.email;
  if (!targetEmail) return;

  const emailLower = targetEmail.toLowerCase().trim();

  // Check suppression list (bounces, complaints, unsubscribed)
  const isSuppressed = await EmailSuppression.findOne({ emailLower });
  if (isSuppressed) {
    logger.info({ msg: 'Email suppressed due to prior bounce/unsub', email: emailLower });
    await EmailLog.create({
      recipientId: user?._id,
      email: emailLower,
      type,
      status: 'suppressed'
    });
    return;
  }

  // If this is a grace-delayed notification email, verify if user already read it in-app
  if (notificationId) {
    const notif = await Notification.findById(notificationId);
    if (!notif || notif.readAt !== null) {
      logger.info({ msg: 'Notification was already read in-app during grace period. Dropping email.', notificationId });
      return;
    }
  }

  // Guard daily email quota
  const hasQuota = await checkAndIncrementQuota();
  if (!hasQuota) {
    await EmailLog.create({
      recipientId: user?._id,
      email: emailLower,
      type,
      status: 'deferred'
    });
    return;
  }

  const unsubUrl = `${env.API_BASE_URL}/api/v1/notifications/unsubscribe?token=${user?._id || 'direct'}&email=${encodeURIComponent(emailLower)}`;

  try {
    const info = await transporter.sendMail({
      from: env.EMAIL_FROM,
      replyTo: 'iam.professor.adnan@gmail.com',
      to: targetEmail,
      subject: subject || `[Qelem] New activity on your devlog`,
      html: htmlBody || `<p>Hello ${user?.displayName || 'Developer'},</p><p>You have new technical activity on your devlog post. Visit Qelem to join the discussion.</p>`,
      headers: {
        'List-Unsubscribe': `<${unsubUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
      }
    });

    await EmailLog.create({
      recipientId: user?._id,
      email: emailLower,
      type,
      status: 'sent',
      providerMessageId: info.messageId
    });

    logger.info({ msg: 'Email successfully sent', recipient: emailLower, type });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error({ msg: 'Email sending failed', recipient: emailLower, error: errMsg });

    await EmailLog.create({
      recipientId: user?._id,
      email: emailLower,
      type,
      status: 'failed'
    });
    throw err;
  }
}
