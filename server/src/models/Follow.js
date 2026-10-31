import { Schema, model } from 'mongoose';
const FollowSchema = new Schema({
    followerId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    followeeId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: { createdAt: true, updatedAt: false }
});
// Natural unique index prevents duplicate follow edges
FollowSchema.index({ followerId: 1, followeeId: 1 }, { unique: true });
// Index A: (followeeId, _id) for chunked keyset fan-out paging
FollowSchema.index({ followeeId: 1, _id: 1 });
// Index B: (followerId, _id) for following list queries and cold rebuilds
FollowSchema.index({ followerId: 1, _id: 1 });
export const Follow = model('Follow', FollowSchema);
