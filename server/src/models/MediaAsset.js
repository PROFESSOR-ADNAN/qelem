import { Schema, model } from 'mongoose';
const MediaAssetSchema = new Schema({
    ownerId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    clientAssetId: {
        type: String,
        required: true
    },
    state: {
        type: String,
        enum: ['pending', 'uploaded', 'processing', 'ready', 'rejected'],
        default: 'pending',
        index: true
    },
    contentType: {
        type: String,
        required: true
    },
    size: {
        type: Number,
        required: true
    },
    incomingKey: {
        type: String,
        required: true
    },
    contentHash: {
        type: String
    },
    variants: {
        thumb: {
            key: String,
            url: String,
            width: Number,
            height: Number,
            bytes: Number,
            format: String
        },
        medium: {
            key: String,
            url: String,
            width: Number,
            height: Number,
            bytes: Number,
            format: String
        },
        large: {
            key: String,
            url: String,
            width: Number,
            height: Number,
            bytes: Number,
            format: String
        }
    },
    placeholder: {
        type: String
    },
    originalWidth: {
        type: Number
    },
    originalHeight: {
        type: Number
    },
    attachedPostId: {
        type: Schema.Types.ObjectId,
        ref: 'Post',
        default: null,
        index: true
    },
    rejectionReason: {
        type: String
    }
}, {
    timestamps: true
});
MediaAssetSchema.index({ ownerId: 1, clientAssetId: 1 }, { unique: true });
export const MediaAsset = model('MediaAsset', MediaAssetSchema);
