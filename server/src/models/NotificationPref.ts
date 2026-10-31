import { Schema, model, Document, Types } from 'mongoose';

export interface INotificationPref extends Document {
  userId: Types.ObjectId;
  emailLikes: boolean;
  emailComments: boolean;
  emailMentions: boolean;
  emailFollows: boolean;
  emailDailyDigest: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationPrefSchema = new Schema<INotificationPref>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    emailLikes: { type: Boolean, default: false },
    emailComments: { type: Boolean, default: true },
    emailMentions: { type: Boolean, default: true },
    emailFollows: { type: Boolean, default: false },
    emailDailyDigest: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const NotificationPref = model<INotificationPref>('NotificationPref', NotificationPrefSchema);
