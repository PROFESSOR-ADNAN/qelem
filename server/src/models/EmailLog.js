import { Schema, model } from 'mongoose';
const EmailLogSchema = new Schema({
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    email: { type: String, required: true },
    type: { type: String, required: true },
    status: { type: String, enum: ['sent', 'deferred', 'suppressed', 'failed'], required: true },
    providerMessageId: { type: String }
}, { timestamps: { createdAt: true, updatedAt: false } });
// TTL index to automatically purge email logs after 30 days
EmailLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
export const EmailLog = model('EmailLog', EmailLogSchema);
