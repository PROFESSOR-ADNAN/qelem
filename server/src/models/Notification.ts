import { Schema, model, Document, Types } from 'mongoose';
import { NotificationType, NotificationTargetType, SYSTEM_LIMITS } from '@qelem/shared';

export interface INotification extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: NotificationType;
  groupKey: string;
  actorIds: Types.ObjectId[];
  actorCount: number;
  targetType: NotificationTargetType;
  targetId: Types.ObjectId;
  seenAt?: Date | null;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['like', 'comment', 'reply', 'mention', 'follow'],
      required: true
    },
    groupKey: {
      type: String,
      required: true
    },
    actorIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    actorCount: {
      type: Number,
      default: 1
    },
    targetType: {
      type: String,
      enum: ['post', 'comment', 'user'],
      required: true
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true
    },
    seenAt: {
      type: Date,
      default: null
    },
    readAt: {
      type: Date,
      default: null,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// CRITICAL PARTIAL UNIQUE INDEX: guarantees race-safe aggregation for unread groups
NotificationSchema.index(
  { userId: 1, groupKey: 1 },
  {
    unique: true,
    partialFilterExpression: { readAt: null }
  }
);

// In-app notifications cursor-pagination query index
NotificationSchema.index({ userId: 1, updatedAt: -1, _id: -1 });

// Automatic TTL purge after 90 days
NotificationSchema.index(
  { updatedAt: 1 },
  { expireAfterSeconds: SYSTEM_LIMITS.NOTIFICATIONS_TTL_DAYS * 24 * 60 * 60 }
);

export const Notification = model<INotification>('Notification', NotificationSchema);
