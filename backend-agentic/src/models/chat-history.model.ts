import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: Array<{ section?: string; snippet?: string }>;
  timestamp: Date;
}

export interface IChatHistory extends Document {
  user_id: string;
  mission_id: string;
  messages: IChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const ChatHistorySchema = new Schema<IChatHistory>(
  {
    user_id: {
      type: String,
      required: true,
      index: true,
    },
    mission_id: {
      type: String,
      required: true,
      index: true,
    },
    messages: [
      {
        role: {
          type: String,
          enum: ['user', 'assistant', 'system'],
          required: true,
        },
        content: {
          type: String,
          required: true,
        },
        sources: [
          {
            section: String,
            snippet: String,
          },
        ],
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

ChatHistorySchema.index({ user_id: 1, mission_id: 1 }, { unique: true });

export const ChatHistoryModel: Model<IChatHistory> =
  mongoose.models.ChatHistory || mongoose.model<IChatHistory>('ChatHistory', ChatHistorySchema);
