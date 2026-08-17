import { MissionModel } from '../models/mission.model.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export interface HeartbeatHandle {
  stop: () => void;
}

export function startHeartbeat(
  requestId: string,
  workerId: string,
  intervalMs: number = env.HEARTBEAT_INTERVAL_MS
): HeartbeatHandle {
  let active = true;

  const interval = setInterval(async () => {
    if (!active) return;
    try {
      await MissionModel.updateOne(
        { request_id: requestId, status: 'processing', worker_id: workerId },
        { $set: { last_seen_at: new Date() } }
      );
      logger.debug({ requestId }, 'Updated mission worker heartbeat');
    } catch (error) {
      logger.warn({ err: error, requestId }, 'Failed to update mission worker heartbeat');
    }
  }, intervalMs);

  return {
    stop: () => {
      active = false;
      clearInterval(interval);
    },
  };
}