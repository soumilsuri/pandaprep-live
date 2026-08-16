import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { MissionModel } from '../../src/models/mission.model.js';
import { NotesRequestModel } from '../../src/models/notes-request.model.js';
import { claimNextMission } from '../../src/queue/claim.js';
import { recoverStaleMissions } from '../../src/queue/sweeper.js';
import { isTransientError } from '../../src/queue/worker.js';
import { v4 as uuidv4 } from 'uuid';

const makePayload = (email = 'student@example.com') => ({
  email,
  subject_name: 'Algorithms',
  syllabus: 'Unit 1: Sorting',
});

describe('Queue Race: Heartbeat, Sweeper, and Worker Ownership Guard', () => {
  const requestIds = Array.from({ length: 4 }, () => `test-race-${uuidv4()}`);
  const [reqA, reqB, reqC, reqD] = requestIds;

  beforeAll(async () => {
    await connectDB();
    await MissionModel.deleteMany({ request_id: { $in: requestIds } });
    await NotesRequestModel.deleteMany({ requestId: { $in: requestIds } });
  });

  afterAll(async () => {
    await MissionModel.deleteMany({ request_id: { $in: requestIds } });
    await NotesRequestModel.deleteMany({ requestId: { $in: requestIds } });
    await disconnectDB();
  });

  it('Test A: should not requeue a stale mission whose worker heartbeat is still live', async () => {
    await MissionModel.create({
      request_id: reqA,
      status: 'queued',
      next_attempt_at: new Date(Date.now() - 1000),
      payload: makePayload(),
    });

    const claimed = await claimNextMission('worker-A');
    expect(claimed).toBeDefined();
    expect(claimed?.request_id).toBe(reqA);

    // Backdate the mission so it looks stale...
    await MissionModel.updateOne(
      { request_id: reqA },
      { $set: { last_seen_at: new Date(Date.now() - 120000), retry_count: 0 } }
    );

    // ...but the worker's heartbeat (worker_id-scoped) refreshes it
    const heartbeatResult = await MissionModel.updateOne(
      { request_id: reqA, status: 'processing', worker_id: 'worker-A' },
      { $set: { last_seen_at: new Date() } }
    );
    expect(heartbeatResult.modifiedCount).toBe(1);

    const sweep = await recoverStaleMissions(45000, 3);
    expect(sweep.recovered).toBe(0);
    expect(sweep.failed).toBe(0);

    const mission = await MissionModel.findOne({ request_id: reqA });
    expect(mission?.status).toBe('processing');
    expect(mission?.worker_id).toBe('worker-A');
    expect(mission?.retry_count).toBe(0);
  });

  it('Test B: should requeue a stale abandoned mission', async () => {
    await MissionModel.create({
      request_id: reqB,
      status: 'queued',
      next_attempt_at: new Date(Date.now() - 1000),
      payload: makePayload(),
    });

    const claimed = await claimNextMission('worker-B');
    expect(claimed).toBeDefined();
    expect(claimed?.request_id).toBe(reqB);

    await MissionModel.updateOne(
      { request_id: reqB },
      { $set: { last_seen_at: new Date(Date.now() - 120000), retry_count: 0 } }
    );

    const sweep = await recoverStaleMissions(45000, 3);
    expect(sweep.recovered).toBe(1);
    expect(sweep.failed).toBe(0);

    const mission = await MissionModel.findOne({ request_id: reqB });
    expect(mission?.status).toBe('queued');
    expect(mission?.worker_id).toBeNull();
    expect(mission?.retry_count).toBe(1);
  });

  it('Test C: should mark stale mission failed once retries are exhausted', async () => {
    await NotesRequestModel.create({
      requestId: reqC,
      type: 'pdf_generation',
      subject_name: 'Algorithms',
      display_name: 'Algo Notes',
      syllabus: 'Unit 1: Sorting',
      note_type: 'detailed',
      include_examples: 'no',
      status: 'queued',
    });

    await MissionModel.create({
      request_id: reqC,
      status: 'queued',
      next_attempt_at: new Date(Date.now() - 1000),
      payload: makePayload(),
    });

    const claimed = await claimNextMission('worker-C');
    expect(claimed).toBeDefined();
    expect(claimed?.request_id).toBe(reqC);

    await MissionModel.updateOne(
      { request_id: reqC },
      { $set: { last_seen_at: new Date(Date.now() - 120000), retry_count: 3 } }
    );

    const sweep = await recoverStaleMissions(45000, 3);
    expect(sweep.failed).toBe(1);
    expect(sweep.recovered).toBe(0);

    const mission = await MissionModel.findOne({ request_id: reqC });
    expect(mission?.status).toBe('failed');
    expect(mission?.error?.message).toBe(
      'Mission timed out and exceeded maximum recovery retry limit'
    );

    const notesRequest = await NotesRequestModel.findOne({ requestId: reqC });
    expect(notesRequest?.status).toBe('failed');
  });

  it('Test D: should not complete a mission re-claimed by another worker', async () => {
    await MissionModel.create({
      request_id: reqD,
      status: 'queued',
      next_attempt_at: new Date(Date.now() - 1000),
      payload: makePayload(),
    });

    const claimed = await claimNextMission('worker-A');
    expect(claimed).toBeDefined();
    expect(claimed?.request_id).toBe(reqD);

    // Simulate sweeper requeue + re-claim by worker-B (as claim.ts would do)
    await MissionModel.updateOne(
      { request_id: reqD },
      {
        $set: {
          status: 'processing',
          worker_id: 'worker-B',
          last_seen_at: new Date(),
        },
      }
    );

    // Old worker-A runs the success-path update exactly as worker.ts does
    const completionResult = await MissionModel.updateOne(
      { request_id: reqD, worker_id: 'worker-A', status: 'processing' },
      { $set: { status: 'completed' } }
    );
    expect(completionResult.modifiedCount).toBe(0);

    const mission = await MissionModel.findOne({ request_id: reqD });
    expect(mission?.status).toBe('processing');
    expect(mission?.worker_id).toBe('worker-B');
  });

  it('Test E: heartbeat from a stale worker should not rescue a re-claimed mission', async () => {
    const missionBefore = await MissionModel.findOne({ request_id: reqD });
    expect(missionBefore).toBeDefined();
    const lastSeenBefore = missionBefore?.last_seen_at?.getTime();

    // worker-A's heartbeat filter must not match the worker-B-owned doc
    const heartbeatResult = await MissionModel.updateOne(
      { request_id: reqD, status: 'processing', worker_id: 'worker-A' },
      { $set: { last_seen_at: new Date() } }
    );
    expect(heartbeatResult.modifiedCount).toBe(0);

    const missionAfter = await MissionModel.findOne({ request_id: reqD });
    expect(missionAfter?.last_seen_at?.getTime()).toBe(lastSeenBefore);
    expect(missionAfter?.worker_id).toBe('worker-B');
  });

  it('Test F: should classify transient vs permanent errors', () => {
    expect(isTransientError(new Error('Request timed out after 30 seconds'))).toBe(true);
    expect(isTransientError(new Error('fetch failed: socket hang up'))).toBe(true);
    expect(isTransientError(new Error('ECONNRESET: read ECONNRESET'))).toBe(true);
    expect(isTransientError(new Error('ECONNREFUSED: connection refused'))).toBe(true);
    expect(isTransientError(new Error('Rate limit exceeded (429 too many requests)'))).toBe(true);
    expect(isTransientError(new Error('Service unavailable (503)'))).toBe(true);
    expect(isTransientError(new Error('Internal server error'))).toBe(true);
    expect(isTransientError(new Error('Quota exceeded for API key'))).toBe(true);
    expect(isTransientError(new Error('deadline exceeded waiting for response'))).toBe(true);

    expect(isTransientError(new Error('The prompt produced invalid JSON'))).toBe(false);
    expect(isTransientError('some plain string')).toBe(false);
    expect(isTransientError(null)).toBe(false);
    expect(isTransientError(undefined)).toBe(false);
  });
});