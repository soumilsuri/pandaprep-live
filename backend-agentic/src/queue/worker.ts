import { CallbackHandler } from 'langfuse-langchain';
import { claimNextMission } from './claim.js';
import { startHeartbeat } from './heartbeat.js';
import { notesGenerationGraph } from '../graph/graph.js';
import { mongoCheckpointer } from '../graph/checkpointer.js';
import { MissionModel, IMission } from '../models/mission.model.js';
import { NotesRequestModel } from '../models/notes-request.model.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { v4 as uuidv4 } from 'uuid';

const TRANSIENT_ERROR_MARKERS = [
  'timeout',
  'timed out',
  'econnreset',
  'econnrefused',
  'socket',
  'network',
  'rate limit',
  '429',
  '503',
  'internal server error',
  'quota',
  'too many requests',
  'deadline',
];

export function isTransientError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const lower = message.toLowerCase();
  return TRANSIENT_ERROR_MARKERS.some((marker) => lower.includes(marker));
}

const RESUME_STATE_KEYS = [
  'syllabusTopics',
  'topicGraph',
  'coverageChecklist',
  'generatedSections',
  'termsDefined',
  'crossReferenceAnchors',
  'styleDecisions',
  'sourcesUsed',
  'verificationResults',
  'repairIterations',
  'documentRepairPasses',
  'outstandingGaps',
  'finalMarkdown',
] as const;

const ARRAY_RESUME_KEYS = new Set<string>([
  'syllabusTopics',
  'coverageChecklist',
  'termsDefined',
  'crossReferenceAnchors',
  'verificationResults',
  'outstandingGaps',
]);

const OBJECT_RESUME_KEYS = new Set<string>([
  'topicGraph',
  'generatedSections',
  'styleDecisions',
  'sourcesUsed',
  'repairIterations',
]);

function isValidResumeValue(key: string, value: unknown): boolean {
  if (key === 'documentRepairPasses') return typeof value === 'number';
  if (key === 'finalMarkdown') return typeof value === 'string';
  if (ARRAY_RESUME_KEYS.has(key)) return Array.isArray(value);
  if (OBJECT_RESUME_KEYS.has(key)) return typeof value === 'object' && value !== null && !Array.isArray(value);
  return false;
}

/**
 * Merges checkpoint state over freshly-built initial state (WR-009).
 * Only known working-memory keys that are present and shape-valid in the
 * checkpoint win; everything else is ignored.
 */
export function mergeCheckpointIntoInitialState(
  initial: Record<string, unknown>,
  checkpoint: Record<string, unknown>
): Record<string, unknown> {
  const merged = { ...initial };
  for (const key of RESUME_STATE_KEYS) {
    const value = checkpoint[key];
    if (value === undefined || value === null) continue;
    if (!isValidResumeValue(key, value)) continue;
    merged[key] = value;
  }
  return merged;
}

export class AgentWorker {
  public workerId: string;
  private isRunning: boolean = false;
  private loopPromise: Promise<void> | null = null;
  private pollIntervalMs: number;

  constructor(workerId = `worker-${uuidv4().slice(0, 8)}`, pollIntervalMs = 2000) {
    this.workerId = workerId;
    this.pollIntervalMs = pollIntervalMs;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info({ workerId: this.workerId }, 'Starting agent worker loop...');
    this.loopPromise = this.runLoop();
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.loopPromise) {
      await this.loopPromise;
    }
    logger.info({ workerId: this.workerId }, 'Agent worker loop stopped');
  }

  private async runLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        const mission = await claimNextMission(this.workerId);
        if (mission) {
          await this.processMission(mission);
        } else {
          // Sleep for poll interval
          await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
        }
      } catch (error) {
        logger.error({ err: error, workerId: this.workerId }, 'Unhandled error in worker loop cycle');
        await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
      }
    }
  }

  public async processMission(mission: IMission): Promise<void> {
    const requestId = mission.request_id;
    const startTime = Date.now();
    const heartbeat = startHeartbeat(requestId, this.workerId);

    logger.info({ requestId, workerId: this.workerId }, 'Beginning processing for mission');

    // Update status in NotesRequestModel
    await NotesRequestModel.updateOne(
      { requestId },
      { $set: { status: 'processing' } }
    );

    try {
      const payload = mission.payload;

      // Construct initial LangGraph state
      const initialState: Record<string, unknown> = {
        missionId: requestId,
        userId: mission.user_id ? String(mission.user_id) : undefined,
        email: payload.email,
        subjectName: payload.subject_name,
        syllabus: payload.syllabus,
        userInstructions: payload.user_instructions,
        noteType: payload.note_type || 'detailed',
        educationLevel: payload.education_level || 'intermediate',
        includeExamples: payload.include_examples || 'no',
        relativePathToReferenceMaterial: payload.relativePathToReferenceMaterial,
        format: payload.format || 'markdown',
      };

      // Resume from the latest checkpoint when one exists: checkpoint state
      // wins for working-memory keys so a restarted worker skips completed
      // work instead of re-generating everything (WR-009).
      const checkpoint = await mongoCheckpointer.loadLatestCheckpoint(requestId);
      let graphInput: Record<string, unknown> = initialState;
      if (checkpoint) {
        graphInput = mergeCheckpointIntoInitialState(initialState, checkpoint.state);
        logger.info({ requestId, checkpointNode: checkpoint.node }, 'Resuming mission from latest checkpoint');
      }

      // Initialize Langfuse span telemetry callback handler (Pillar 1)
      let callbacks: unknown[] | undefined;
      try {
        if (env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY) {
          const langfuseHandler = new CallbackHandler({
            publicKey: env.LANGFUSE_PUBLIC_KEY,
            secretKey: env.LANGFUSE_SECRET_KEY,
            baseUrl: env.LANGFUSE_HOST,
            sessionId: requestId,
            userId: mission.user_id ? String(mission.user_id) : undefined,
            tags: [payload.note_type || 'detailed', env.NODE_ENV],
          });
          callbacks = [langfuseHandler];
        }
      } catch (cbErr) {
        logger.warn({ err: cbErr, requestId }, 'Failed to initialize Langfuse callback handler; continuing without telemetry');
      }

      // Execute LangGraph StateGraph
      const finalState = await notesGenerationGraph.invoke(
        graphInput,
        callbacks ? { callbacks: callbacks as any } : undefined
      );
      const processingTimeMs = Date.now() - startTime;

      // Persist completed results — only if this worker still owns the mission
      const missionResult = await MissionModel.updateOne(
        { request_id: requestId, worker_id: this.workerId, status: 'processing' },
        { $set: { status: 'completed' } }
      );

      if (missionResult.modifiedCount === 0) {
        logger.warn(
          { requestId, workerId: this.workerId },
          'Mission no longer owned by this worker; not marking completed'
        );
      } else {
        await NotesRequestModel.updateOne(
          { requestId },
          {
            $set: {
              status: 'completed',
              markdown_content: finalState.finalMarkdown,
              processing_time_ms: processingTimeMs,
            },
          }
        );

        logger.info(
          { requestId, processingTimeMs },
          'Mission processed and completed successfully'
        );
      }
    } catch (error: unknown) {
      const processingTimeMs = Date.now() - startTime;
      logger.error({ err: error, requestId }, 'Mission processing encountered fatal error');

      const transient = isTransientError(error);
      const errorName = error instanceof Error ? error.name : 'Unknown';

      if (transient && mission.retry_count < env.MISSION_MAX_RETRIES) {
        // Exponential backoff: 1s, 2s, 4s, ... capped at 60s
        const backoffMs = Math.min(1000 * Math.pow(2, mission.retry_count), 60000);
        const requeueResult = await MissionModel.updateOne(
          { request_id: requestId, worker_id: this.workerId, status: 'processing' },
          {
            $set: {
              status: 'queued',
              worker_id: null,
              next_attempt_at: new Date(Date.now() + backoffMs),
            },
            $inc: { retry_count: 1 },
          }
        );

        if (requeueResult.modifiedCount > 0) {
          await NotesRequestModel.updateOne(
            { requestId },
            { $set: { status: 'queued' } }
          );
          logger.info({ requestId, backoffMs }, 'Mission requeued for transient failure');
        } else {
          logger.warn(
            { requestId, workerId: this.workerId },
            'Mission no longer owned by this worker; not requeuing'
          );
        }
      } else {
        // Permanent failure (or transient retries exhausted): store only a generic reason
        const failureMessage = transient
          ? 'Generation failed after maximum retry limit'
          : `Generation failed: ${errorName}`;

        const failResult = await MissionModel.updateOne(
          { request_id: requestId, worker_id: this.workerId, status: 'processing' },
          {
            $set: {
              status: 'failed',
              error: {
                message: failureMessage,
                occurred_at: new Date(),
              },
            },
          }
        );

        if (failResult.modifiedCount > 0) {
          await NotesRequestModel.updateOne(
            { requestId },
            {
              $set: {
                status: 'failed',
                processing_time_ms: processingTimeMs,
                error: {
                  message: failureMessage,
                  occurred_at: new Date(),
                },
              },
            }
          );
        } else {
          logger.warn(
            { requestId, workerId: this.workerId },
            'Mission no longer owned by this worker; not marking failed'
          );
        }
      }
    } finally {
      heartbeat.stop();
    }
  }
}

export const defaultWorker = new AgentWorker();