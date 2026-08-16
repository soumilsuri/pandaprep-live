import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IUserRequest extends Document {
  user_id?: string;
  requestId: string;
  jobId?: string;
  type: 'pdf_generation' | 'pdf_chat';
  subject_name: string;
  display_name: string;
  syllabus: string;
  note_type: 'concise' | 'detailed' | 'qa';
  education_level?: 'beginner' | 'intermediate' | 'advanced';
  include_examples: 'yes' | 'no';
  user_instructions?: string;
  format: 'pdf' | 'markdown';
  status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed';
  relativePathToReferenceMaterial?: string;
  processing_time_ms?: number | null;
  markdown_content?: string;
  secure_url?: string;
  public_id?: string;
  error?: {
    message?: string;
    details?: string;
    occurred_at?: Date;
  };
  output_file?: {
    filename?: string;
    path?: string;
    size_bytes?: number;
    created_at?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserRequestSchema = new Schema<IUserRequest>(
  {
    user_id: {
      type: String,
    },
    requestId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    jobId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['pdf_generation', 'pdf_chat'],
      default: 'pdf_generation',
      required: true,
    },
    subject_name: {
      type: String,
      required: [true, 'Subject name is required'],
      trim: true,
      maxlength: [100, 'Subject name cannot be more than 100 characters'],
    },
    display_name: {
      type: String,
      required: [true, 'Display name is required'],
      trim: true,
      maxlength: [100, 'Display name cannot be more than 100 characters'],
    },
    syllabus: {
      type: String,
      required: [true, 'Syllabus content is required'],
      trim: true,
    },
    note_type: {
      type: String,
      enum: ['concise', 'detailed', 'qa'],
      default: 'detailed',
      lowercase: true,
      trim: true,
    },
    education_level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'intermediate',
    },
    include_examples: {
      type: String,
      enum: ['yes', 'no'],
      default: 'no',
    },
    user_instructions: {
      type: String,
      trim: true,
      default: '',
    },
    format: {
      type: String,
      enum: ['pdf', 'markdown'],
      default: 'markdown',
      lowercase: true,
    },
    markdown_content: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'queued', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    relativePathToReferenceMaterial: {
      type: String,
      default: '',
      trim: true,
    },
    processing_time_ms: {
      type: Number,
      default: null,
    },
    error: {
      message: String,
      details: String,
      occurred_at: Date,
    },
    output_file: {
      filename: String,
      path: String,
      size_bytes: Number,
      created_at: Date,
    },
    secure_url: {
      type: String,
    },
    public_id: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

UserRequestSchema.index({ createdAt: -1 });

export const NotesRequestModel: Model<IUserRequest> =
  mongoose.models.UserRequest || mongoose.model<IUserRequest>('UserRequest', UserRequestSchema);
