import { Schema, model, Document, Types } from 'mongoose';
import { SYSTEM_LIMITS } from '@qelem/shared';

export interface IComment extends Document {
  _id: Types.ObjectId;
  postId: Types.ObjectId;
  authorId: Types.ObjectId;
  parentId?: Types.ObjectId | null;
  clientCommentId: string;
  text: string;
  mentions: Types.ObjectId[];
  state: 'published' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
      index: true
    },
    clientCommentId: {
      type: String,
      required: true
    },
    text: {
      type: String,
      required: true,
      maxlength: SYSTEM_LIMITS.COMMENT_TEXT_MAX_LENGTH,
      trim: true
    },
    mentions: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    state: {
      type: String,
      enum: ['published', 'deleted'],
      default: 'published'
    }
  },
  {
    timestamps: true
  }
);

// Idempotency constraint per clientCommentId
CommentSchema.index({ authorId: 1, clientCommentId: 1 }, { unique: true });

// Oldest-first hierarchical comment feed query index
CommentSchema.index({ postId: 1, parentId: 1, _id: 1 });

export const Comment = model<IComment>('Comment', CommentSchema);
