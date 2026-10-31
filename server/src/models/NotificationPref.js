import { Schema, model } from 'mongoose';
const NotificationPrefSchema = new Schema({
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
}, { timestamps: true });
export const NotificationPref = model('NotificationPref', NotificationPrefSchema);
