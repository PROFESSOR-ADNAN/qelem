import { Schema, model, Document, Types } from 'mongoose';
import { REPORT_REASONS } from '@qelem/shared';

export interface IReport extends Document {
  reporterId: Types.ObjectId;
  targetType: 'post' | 'comment' | 'user';
  targetId: Types.ObjectId;
  reason: typeof REPORT_REASONS[number];
  notes?: string;
  status: 'pending' | 'reviewed' | 'actioned' | 'dismissed';
  resolvedBy?: Types.ObjectId;
  contentSnapshot?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    targetType: {
      type: String,
      enum: ['post', 'comment', 'user'],
      required: true
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true
    },
    reason: {
      type: String,
      enum: REPORT_REASONS,
      required: true
    },
    notes: {
      type: String,
      maxlength: 500
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'actioned', 'dismissed'],
      default: 'pending',
      index: true
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    contentSnapshot: {
      type: Schema.Types.Mixed
    }
  },
  {
    timestamps: true
  }
);

// One report per user per target
ReportSchema.index({ reporterId: 1, targetType: 1, targetId: 1 }, { unique: true });

export const Report = model<IReport>('Report', ReportSchema);
