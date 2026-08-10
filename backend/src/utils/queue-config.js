// queue-config.js — MongoDB-backed in-memory job queue
// No WebSocket broadcasts, no cron intervals, no SIGINT handlers (serverless compatible)
import { generateNotes } from '../controllers/pipeline.controller.js';
import { JobModel } from '../models/jobs-queue.model.js';

const queue = [];
let activeJobs = 0;
const MAX_CONCURRENT_JOBS = 1;

// Process jobs one by one
async function processQueue() {
  if (activeJobs >= MAX_CONCURRENT_JOBS || queue.length === 0) return;

  const job = queue.shift();
  if (!job) return;

  activeJobs++;
  await JobModel.findByIdAndUpdate(job._id, { status: 'processing', updatedAt: new Date() });

  const { requestId, data } = job;

  try {
    console.log(`[Queue] Starting job ${job._id} for requestId ${requestId}`);
    await generateNotes(requestId, data.requestBody, data.requestIdDb, data.userId);

    await JobModel.findByIdAndUpdate(job._id, { status: 'completed', updatedAt: new Date() });
    console.log(`[Queue] Job ${job._id} completed successfully`);
  } catch (err) {
    console.error(`[Queue] Job ${job._id} failed:`, err.message);
    await JobModel.findByIdAndUpdate(job._id, {
      status: 'failed',
      updatedAt: new Date(),
      $inc: { retries: 1 },
    });
  } finally {
    activeJobs--;
    processQueue(); // Process next job
  }
}

// Adds job to MongoDB and in-memory queue
export async function addToQueue(requestId, data) {
  try {
    const job = new JobModel({ requestId, data });
    await job.save();

    queue.push(job);
    processQueue();

    const queuedCount = await JobModel.countDocuments({ status: 'queued' });

    console.log(`[Queue] Job ${job._id} added. Queue position: ${queuedCount}`);
    return job;
  } catch (err) {
    console.error('[Queue] Error adding job:', err);
    throw err;
  }
}

export async function getQueueStatus(jobId) {
  try {
    const job = await JobModel.findById(jobId);
    if (!job) return null;

    // Count jobs that were created before this job and are still pending
    const position = await JobModel.countDocuments({
      status: 'queued',
      createdAt: { $lt: job.createdAt },
    });

    return {
      state: job.status,
      position,
    };
  } catch (err) {
    console.error('[Queue] Error getting queue status:', err);
    return null;
  }
}

// On startup, reload unfinished jobs from MongoDB
export async function recoverPendingJobs() {
  try {
    const pendingJobs = await JobModel.find({ status: { $in: ['queued', 'processing'] } }).sort({ createdAt: 1 });
    
    if (pendingJobs.length > 0) {
      // Mark any previously-processing jobs as failed (they were interrupted by a restart)
      const processingJobs = pendingJobs.filter(j => j.status === 'processing');
      for (const job of processingJobs) {
        await JobModel.findByIdAndUpdate(job._id, { 
          status: 'failed', 
          updatedAt: new Date() 
        });
        console.log(`[Queue] Marked interrupted job ${job._id} as failed`);
      }

      // Re-queue jobs that were queued (not yet started)
      const queuedJobs = pendingJobs.filter(j => j.status === 'queued');
      queue.push(...queuedJobs);
      console.log(`[Queue] Recovered ${queuedJobs.length} pending jobs from MongoDB`);
      processQueue();
    } else {
      console.log('[Queue] No pending jobs to recover');
    }
  } catch (err) {
    console.error('[Queue] Error recovering pending jobs:', err);
  }
}
