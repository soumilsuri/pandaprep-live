import mongoose from 'mongoose';

const ChatHistorySchema = new mongoose.Schema(
  {
    _userID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserModel',
      required: true,
    },
    _historyID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserRequest',
      required: true,
    },
    documentId: {
      type: String,
      required: true,
    },
    messages: [{
      role: {
        type: String,
        enum: ['user', 'assistant'],
        required: true,
      },
      content: {
        type: String,
        required: true,
      },
      timestamp: {
        type: Date,
        default: Date.now,
      }
    }],
    pdfUrl: {
      type: String,
      required: true,
    },
    pdfName: {
      type: String,
      required: true,
    }
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
ChatHistorySchema.index({ _userID: 1, createdAt: -1 });
ChatHistorySchema.index({ _historyID: 1 });

export const ChatHistoryModel = mongoose.model('ChatHistory', ChatHistorySchema); 