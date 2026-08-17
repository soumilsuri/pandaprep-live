import { MissionModel } from '../models/mission.model.js';
import { NotesRequestModel } from '../models/notes-request.model.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export async function recoverStaleMissions(
  staleThresholdMs: number = env.SWEEPER_STALE_MS,
  maxRetries: number = env.MISSION_MAX_RETRIES
): Promise<{ recovered: number; failed: number }> {
  const staleThreshold = new Date(Date.now() - staleThresholdMs);

  try {
    // 1. Recover missions under max retries whose worker stopped heartbeating
    const recoverResult = await MissionModel.updateMany(
      {
        status: 'processing',
        worker_id: { $ne: null },
        last_seen_at: { $lt: staleThreshold },
        retry_count: { $lt: maxRetries },
      },
      {
        $set: {
          status: 'queued',
          worker_id: null,
          next_attempt_at: new Date(Date.now() + 5000), // 5s backoff
        },
        $inc: { retry_count: 1 },
      }
    );

    // 2. Batch-mark permanently failed missions that exceeded max retries (no per-doc loop)
    const failCandidates = await MissionModel.find({
      status: 'processing',
      worker_id: { $ne: null },
      last_seen_at: { $lt: staleThreshold },
      retry_count: { $gte: maxRetries },
    }).select('request_id');

    const requestIds = failCandidates.map((mission) => mission.request_id);
    let failedCount = 0;
    if (requestIds.length > 0) {
      const failResult = await MissionModel.updateMany(
        { request_id: { $in: requestIds } },
        {
          $set: {
            status: 'failed',
            error: {
              message: 'Mission timed out and exceeded maximum recovery retry limit',
              occurred_at: new Date(),
            },
          },
        }
      );
      failedCount = failResult.modifiedCount;

      // Sync NotesRequestModel in a single batch update
      await NotesRequestModel.updateMany(
        { requestId: { $in: requestIds } },
        {
          $set: {
            status: 'failed',
            error: {
              message: 'Generation failed due to worker timeout',
              occurred_at: new Date(),
            },
          },
        }
      );
    }

    if (recoverResult.modifiedCount > 0 || failedCount > 0) {
      logger.info(
        { recovered: recoverResult.modifiedCount, failed: failedCount },
        'Stale missions sweep cycle completed'
      );
    }

    return {
      recovered: recoverResult.modifiedCount,
      failed: failedCount,
    };
  } catch (error) {
    logger.error({ err: error }, 'Error running stale mission recovery sweep');
    return { recovered: 0, failed: 0 };
  }
}

export function startStaleMissionSweeper(intervalMs: number = env.SWEEPER_INTERVAL_MS) {
  logger.info({ intervalMs }, 'Starting background stale mission sweeper...');
  let running = false;
  const interval = setInterval(async () => {
    if (running) {
      logger.debug('Skipping stale mission sweep: previous cycle still running');
      return;
    }
    running = true;
    try {
      await recoverStaleMissions();
    } finally {
      running = false;
    }
  }, intervalMs);

  return {
    stop: () => clearInterval(interval),
  };
}