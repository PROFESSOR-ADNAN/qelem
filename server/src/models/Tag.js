import { Schema, model } from 'mongoose';
const TagSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    postCount: {
        type: Number,
        default: 0,
        index: true
    },
    lastUsedAt: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true
});
export const Tag = model('Tag', TagSchema);
