import mongoose from "mongoose";

const jobSchema = new mongoose.Schema({
  requestId: String,
  data: Object,
  status: { type: String, enum: ['queued', 'processing', 'completed', 'failed'], default: 'queued' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  retries: { type: Number, default: 0 },
});

export const JobModel = mongoose.model('Job', jobSchema);