import { Schema, model } from 'mongoose';
const EmailSuppressionSchema = new Schema({
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
}, { timestamps: { createdAt: true, updatedAt: false } });
export const EmailSuppression = model('EmailSuppression', EmailSuppressionSchema);
