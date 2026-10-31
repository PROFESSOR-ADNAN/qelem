import { Schema, model } from 'mongoose';
const BookmarkSchema = new Schema({
    postId: {
        type: Schema.Types.ObjectId,
        ref: 'Post',
        required: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: { createdAt: true, updatedAt: false }
});
BookmarkSchema.index({ postId: 1, userId: 1 }, { unique: true });
BookmarkSchema.index({ userId: 1, createdAt: -1 });
export const Bookmark = model('Bookmark', BookmarkSchema);
