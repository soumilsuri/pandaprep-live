import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IRateLimit extends Document {
  userId: string;
  count: number;
  windowStart: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RateLimitSchema = new Schema<IRateLimit>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    count: {
      type: Number,
      default: 1,
    },
    windowStart: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

RateLimitSchema.index({ userId: 1, windowStart: 1 }, { unique: true });
RateLimitSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

export const RateLimitModel: Model<IRateLimit> =
  mongoose.models.RateLimit || mongoose.model<IRateLimit>('RateLimit', RateLimitSchema);
