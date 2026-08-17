import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { MissionModel } from '../../src/models/mission.model.js';
import { claimNextMission } from '../../src/queue/claim.js';
import { recoverStaleMissions } from '../../src/queue/sweeper.js';
import { v4 as uuidv4 } from 'uuid';

describe('MongoDB Atomic Queue Mechanics', () => {
  const testRequestId = `test-req-${uuidv4()}`;

  beforeAll(async () => {
    await connectDB();
    await MissionModel.deleteMany({ request_id: testRequestId });
  });

  afterAll(async () => {
    await MissionModel.deleteMany({ request_id: testRequestId });
    await disconnectDB();
  });

  it('should atomically claim a queued mission and prevent double claiming', async () => {
    // 1. Insert a test mission
    await MissionModel.create({
      request_id: testRequestId,
      status: 'queued',
      next_attempt_at: new Date(Date.now() - 1000),
      payload: {
        email: 'test@example.com',
        subject_name: 'Algorithms',
        syllabus: 'Unit 1: Sorting',
      },
    });

    // 2. Worker 1 claims it
    const claimedByWorker1 = await claimNextMission('worker-01');
    expect(claimedByWorker1).toBeDefined();
    expect(claimedByWorker1?.request_id).toBe(testRequestId);
    expect(claimedByWorker1?.status).toBe('processing');
    expect(claimedByWorker1?.worker_id).toBe('worker-01');

    // 3. Worker 2 attempts to claim concurrently — should get null (no other queued missions)
    const claimedByWorker2 = await claimNextMission('worker-02');
    expect(claimedByWorker2).toBeNull();
  });

  it('should recover stale missions when heartbeat expires', async () => {
    // Make the mission stale by backdating last_seen_at
    await MissionModel.updateOne(
      { request_id: testRequestId },
      {
        $set: {
          status: 'processing',
          last_seen_at: new Date(Date.now() - 120000), // 2 minutes ago
          retry_count: 0,
        },
      }
    );

    const sweepResult = await recoverStaleMissions(60000, 3);
    expect(sweepResult.recovered).toBeGreaterThanOrEqual(1);

    const recoveredMission = await MissionModel.findOne({ request_id: testRequestId });
    expect(recoveredMission?.status).toBe('queued');
    expect(recoveredMission?.worker_id).toBeNull();
    expect(recoveredMission?.retry_count).toBe(1);
  });
});
