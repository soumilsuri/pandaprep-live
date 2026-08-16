import { MissionModel, IMission } from '../models/mission.model.js';
import { logger } from '../config/logger.js';

export async function claimNextMission(workerId: string): Promise<IMission | null> {
  const now = new Date();
  try {
    const mission = await MissionModel.findOneAndUpdate(
      {
        status: 'queued',
        next_attempt_at: { $lte: now },
      },
      {
        $set: {
          status: 'processing',
          worker_id: workerId,
          claimed_at: now,
          last_seen_at: now,
        },
      },
      { sort: { createdAt: 1 }, new: true }
    );

    if (mission) {
      logger.info(
        { missionId: mission.request_id, workerId },
        'Worker successfully claimed queued mission'
      );
    }

    return mission;
  } catch (error) {
    logger.error({ err: error, workerId }, 'Error claiming next mission from queue');
    throw error;
  }
}
