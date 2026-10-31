import { Schema, model, Document, Types } from 'mongoose';

export interface IMute extends Document {
  _id: Types.ObjectId;
  muterId: Types.ObjectId;
  mutedId: Types.ObjectId;
  createdAt: Date;
}

const MuteSchema = new Schema<IMute>(
  {
    muterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    mutedId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

MuteSchema.index({ muterId: 1, mutedId: 1 }, { unique: true });

export const Mute = model<IMute>('Mute', MuteSchema);
