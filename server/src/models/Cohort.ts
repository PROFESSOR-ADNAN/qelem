import { Schema, model, Document } from 'mongoose';

export interface ICohort extends Document {
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const CohortSchema = new Schema<ICohort>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String
    },
    isActive: {
      type: Boolean,
      default: true
    },
    memberCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

export const Cohort = model<ICohort>('Cohort', CohortSchema);
