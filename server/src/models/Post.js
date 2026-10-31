import { Schema, model } from 'mongoose';
import { SYSTEM_LIMITS, CODE_LANGUAGES } from '@qelem/shared';
const PostSchema = new Schema({
    authorId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    clientPostId: {
        type: String,
        required: true
    },
    text: {
        type: String,
        required: true,
        maxlength: SYSTEM_LIMITS.POST_TEXT_MAX_LENGTH,
        trim: true
    },
    code: {
        lang: {
            type: String,
            enum: CODE_LANGUAGES
        },
        body: {
            type: String,
            maxlength: SYSTEM_LIMITS.POST_CODE_MAX_LENGTH
        }
    },
    mediaIds: [
        {
            type: Schema.Types.ObjectId,
            ref: 'MediaAsset'
        }
    ],
    tags: [
        {
            type: String,
            lowercase: true,
            trim: true
        }
    ],
    mentions: [
        {
            type: Schema.Types.ObjectId,
            ref: 'User'
        }
    ],
    state: {
        type: String,
        enum: ['processing', 'published', 'failed', 'hidden', 'deleted'],
        default: 'published',
        index: true
    },
    authorCohortId: {
        type: String,
        default: null,
        index: true
    },
    likeCount: {
        type: Number,
        default: 0
    },
    commentCount: {
        type: Number,
        default: 0
    },
    bookmarkCount: {
        type: Number,
        default: 0
    },
    contentHash: {
        type: String,
        required: true,
        index: true
    },
    publishedAt: {
        type: Date,
        index: true
    },
    editedAt: {
        type: Date
    },
    deletedAt: {
        type: Date,
        index: true
    }
}, {
    timestamps: true
});
// Idempotency constraint: exactly one post per (authorId, clientPostId)
PostSchema.index({ authorId: 1, clientPostId: 1 }, { unique: true });
// Author profile feed index
PostSchema.index({ authorId: 1, state: 1, publishedAt: -1, _id: -1 });
// Tag feed index
PostSchema.index({ tags: 1, state: 1, publishedAt: -1, _id: -1 });
// Cohort feed index
PostSchema.index({ authorCohortId: 1, state: 1, publishedAt: -1, _id: -1 });
// Global published feed index
PostSchema.index({ state: 1, publishedAt: -1, _id: -1 });
export const Post = model('Post', PostSchema);
