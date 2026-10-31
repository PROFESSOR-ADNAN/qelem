import { Schema, model, Document } from 'mongoose';

export interface IEmailSuppression extends Document {
  emailLower: string;
  reason: 'bounce' | 'complaint' | 'unsubscribe';
  createdAt: Date;
}

const EmailSuppressionSchema = new Schema<IEmailSuppression>(
  {
    emailLower: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    reason: {
      type: String,
      enum: ['bounce', 'complaint', 'unsubscribe'],
      required: true
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const EmailSuppression = model<IEmailSuppression>('EmailSuppression', EmailSuppressionSchema);
