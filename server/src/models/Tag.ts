import { Schema, model, Document } from 'mongoose';

export interface ITag extends Document {
  name: string;
  postCount: number;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TagSchema = new Schema<ITag>(
  {
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
  },
  {
    timestamps: true
  }
);

export const Tag = model<ITag>('Tag', TagSchema);
