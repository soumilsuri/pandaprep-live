import mongoose, { Document, Model, Schema } from 'mongoose';

export type MissionStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface IMissionPayload {
  email: string;
  syllabus: string;
  subject_name: string;
  note_type?: 'concise' | 'detailed' | 'qa';
  include_examples?: 'yes' | 'no';
  include_images?: 'yes' | 'no';
  education_level?: 'beginner' | 'intermediate' | 'advanced';
  user_instructions?: string;
  relativePathToReferenceMaterial?: string;
  format?: 'markdown' | 'pdf';
  [key: string]: unknown;
}

export interface IMission extends Document {
  request_id: string;
  user_id?: string;
  status: MissionStatus;
  worker_id?: string | null;
  claimed_at?: Date | null;
  last_seen_at?: Date | null;
  retry_count: number;
  next_attempt_at: Date;
  payload: IMissionPayload;
  error?: {
    message?: string;
    details?: string;
    occurred_at?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const MissionSchema = new Schema<IMission>(
  {
    request_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user_id: {
      type: String,
    },
    status: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'failed'],
      default: 'queued',
      index: true,
    },
    worker_id: {
      type: String,
      default: null,
      index: true,
    },
    claimed_at: {
      type: Date,
      default: null,
    },
    last_seen_at: {
      type: Date,
      default: null,
      index: true,
    },
    retry_count: {
      type: Number,
      default: 0,
    },
    next_attempt_at: {
      type: Date,
      default: Date.now,
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    error: {
      message: String,
      details: String,
      occurred_at: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient atomic queue claiming
MissionSchema.index({ status: 1, next_attempt_at: 1, createdAt: 1 });

export const MissionModel: Model<IMission> =
  mongoose.models.Mission || mongoose.model<IMission>('Mission', MissionSchema);
