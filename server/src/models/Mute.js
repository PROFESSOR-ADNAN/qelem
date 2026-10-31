import { Schema, model } from 'mongoose';
const MuteSchema = new Schema({
    muterId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    mutedId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: { createdAt: true, updatedAt: false }
});
MuteSchema.index({ muterId: 1, mutedId: 1 }, { unique: true });
export const Mute = model('Mute', MuteSchema);
