import mongoose from 'mongoose';

const UserRequestSchema = new mongoose.Schema(
  {
    // User ID
    _userID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserModel',
    },
    // Request tracking IDs
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
    // Type of request
    type: {
      type: String,
      enum: ['pdf_generation', 'pdf_chat'],
      default: 'pdf_generation',
      required: true,
    },
    // Basic information
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
    // Syllabus content
    syllabus: {
      type: String,
      required: [true, 'Syllabus content is required'],
      trim: true,
      minlength: [10, 'Syllabus content is too short'],
      maxlength: [2500, 'Syllabus content cannot be more than 5000 characters'],
    },

    // Note generation options
    note_type: {
      type: String,
      enum: {
        values: ['concise', 'detailed', 'qa'],
        message: '{VALUE} is not a supported note type',
      },
      default: 'detailed',
      lowercase: true,
      trim: true,
    },

    // Examples settings
    include_examples: {
      type: String,
      enum: {
        values: ['yes', 'no'],
        message: 'Include examples must be either "yes" or "no"',
      },
      default: 'no',
    },

    // Additional instructions
    user_instructions: {
      type: String,
      trim: true,
      maxlength: [500, 'User instructions cannot be more than 2000 characters'],
      default: '',
    },

    // Output format preference
    format: {
      type: String,
      enum: {
        values: ['pdf', 'markdown'],
        message: '{VALUE} is not a supported output format',
      },
      default: 'pdf',
      lowercase: true,
    },
    // Status tracking
    status: {
      type: String,
      enum: ['pending', 'queued' ,'processing', 'completed', 'failed'],
      default: 'pending',
    },
    relativePathToReferenceMaterial: {
      type: String,
      default: '',
      trim: true,
    },
    // Processing metrics
    processing_time_ms: {
      type: Number,
      default: null,
    },

    // Error information
    error: {
      message: String,
      details: String,
      occurred_at: Date,
    },

    // Output reference
    output_file: {
      filename: String,
      path: String,
      size_bytes: Number,
      created_at: Date,
    },
    //secure_url for download
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

// Indexes for efficient querying
UserRequestSchema.index({ created_at: -1 });
UserRequestSchema.index({ status: 1 });
UserRequestSchema.index({ subject_name: 'text' });
UserRequestSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

// Virtual for determining if request is completed
UserRequestSchema.virtual('is_completed').get(function () {
  return ['completed', 'failed'].includes(this.status);
});

export const NotesRequestModel = mongoose.model('UserRequest', UserRequestSchema);
