import { Schema, model } from 'mongoose';
const BlockSchema = new Schema({
    blockerId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    blockedId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: { createdAt: true, updatedAt: false }
});
BlockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });
BlockSchema.index({ blockedId: 1 });
export const Block = model('Block', BlockSchema);
