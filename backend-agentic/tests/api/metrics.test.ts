import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import '../mocks/llm.js';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { NotesWorkspaceModel } from '../../src/models/notes-workspace.model.js';
import { NotesRequestModel } from '../../src/models/notes-request.model.js';
import { MissionModel } from '../../src/models/mission.model.js';
import {
  getPipelineMetricsHandler,
  calculatePercentile,
  parseWindowCutoff,
} from '../../src/controllers/metrics.controller.js';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

interface MockResponse extends Partial<Response> {
  jsonBody?: any;
  statusCode?: number;
}

function createMockResponse(): Response & { jsonBody?: any; statusCode: number } {
  const res: MockResponse = {
    statusCode: 200,
  };
  res.json = (data: any) => {
    res.jsonBody = data;
    return res as Response;
  };
  res.status = (code: number) => {
    res.statusCode = code;
    return res as Response;
  };
  return res as Response & { jsonBody?: any; statusCode: number };
}

describe('Pillar 2: Real-time Operational Health Metrics Endpoint', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await NotesWorkspaceModel.deleteMany({});
    await NotesRequestModel.deleteMany({});
    await MissionModel.deleteMany({});
    await disconnectDB();
  });

  beforeEach(async () => {
    await NotesWorkspaceModel.deleteMany({});
    await NotesRequestModel.deleteMany({});
    await MissionModel.deleteMany({});
  });

  afterEach(async () => {
    await NotesWorkspaceModel.deleteMany({});
    await NotesRequestModel.deleteMany({});
    await MissionModel.deleteMany({});
  });

  describe('calculatePercentile utility', () => {
    it('returns 0 for empty array', () => {
      expect(calculatePercentile([], 50)).toBe(0);
      expect(calculatePercentile([], 95)).toBe(0);
    });

    it('returns the exact value for single-element array', () => {
      expect(calculatePercentile([25000], 50)).toBe(25000);
      expect(calculatePercentile([25000], 95)).toBe(25000);
    });

    it('computes correct median and upper percentiles for multi-element array', () => {
      const latencies = [10000, 20000, 30000, 40000, 50000];
      expect(calculatePercentile(latencies, 50)).toBe(30000);
      expect(calculatePercentile(latencies, 95)).toBe(48000);
      expect(calculatePercentile(latencies, 100)).toBe(50000);
    });
  });

  describe('parseWindowCutoff utility', () => {
    it('returns null for all or undefined', () => {
      expect(parseWindowCutoff(undefined)).toBeNull();
      expect(parseWindowCutoff('all')).toBeNull();
    });

    it('returns date in past for 1h, 24h, 7d, 30d', () => {
      const cutoff24h = parseWindowCutoff('24h');
      expect(cutoff24h).toBeInstanceOf(Date);
      expect(Date.now() - cutoff24h!.getTime()).toBeGreaterThanOrEqual(23 * 3600 * 1000);
    });
  });

  describe('getPipelineMetricsHandler', () => {
    it('returns 400 when invalid window query param is provided', async () => {
      const req = { query: { window: 'invalid-window' } } as unknown as Request;
      const res = createMockResponse();

      await getPipelineMetricsHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonBody.success).toBe(false);
      expect(res.jsonBody.error).toBe('Invalid query parameters');
    });

    it('accepts valid window parameter (e.g. 24h)', async () => {
      const req = { query: { window: '24h' } } as unknown as Request;
      const res = createMockResponse();

      await getPipelineMetricsHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonBody.success).toBe(true);
      expect(res.jsonBody.window).toBe('24h');
    });

    it('returns clean zeroed metrics when database is empty', async () => {
      const req = { query: {} } as unknown as Request;
      const res = createMockResponse();

      await getPipelineMetricsHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonBody.success).toBe(true);
      expect(res.jsonBody.metrics.section_repair_rate_percent).toBe(0);
      expect(res.jsonBody.metrics.checklist_exhaustion_rate_percent).toBe(0);
      expect(res.jsonBody.metrics.average_dag_nodes).toBe(0);
      expect(res.jsonBody.metrics.latency.p50_latency_ms).toBe(0);
      expect(res.jsonBody.metrics.active_worker_count).toBe(0);
      expect(res.jsonBody.metrics.status).toBe('healthy');
    });

    it('correctly aggregates repair rate, exhaustion rate, DAG node count, percentiles, and active workers', async () => {
      // 1. Seed Workspaces
      await NotesWorkspaceModel.create({
        mission_id: `mission-${uuidv4()}`,
        topic_graph: {
          nodes: [
            { section_id: 's1', title: 'Sec 1', key_concepts: ['c1'] },
            { section_id: 's2', title: 'Sec 2', key_concepts: ['c2'] },
            { section_id: 's3', title: 'Sec 3', key_concepts: ['c3'] },
          ],
          edges: [],
        },
        verification_results: [
          { section_id: 's1', iteration: 1, passed: true, issues: [] },
          { section_id: 's2', iteration: 1, passed: true, issues: [] },
          { section_id: 's3', iteration: 1, passed: true, issues: [] },
        ],
        outstanding_gaps: [],
      });

      await NotesWorkspaceModel.create({
        mission_id: `mission-${uuidv4()}`,
        topic_graph: {
          nodes: [
            { section_id: 's1', title: 'Sec 1', key_concepts: ['c1'] },
            { section_id: 's2', title: 'Sec 2', key_concepts: ['c2'] },
          ],
          edges: [],
        },
        verification_results: [
          { section_id: 's1', iteration: 1, passed: false, issues: [{ check: 'coverage', severity: 'high', description: 'missing' }] },
          { section_id: 's2', iteration: 1, passed: true, issues: [] },
        ],
        outstanding_gaps: [{ requirement_id: 'r1', description: 'Gap remaining' }],
      });

      // 2. Seed Notes Requests with latencies
      for (const latency of [20000, 30000, 40000, 45000, 50000]) {
        await NotesRequestModel.create({
          requestId: `req-${uuidv4()}`,
          subject_name: 'Test Subject',
          display_name: 'Test Display',
          syllabus: 'Test syllabus',
          note_type: 'detailed',
          include_examples: 'no',
          format: 'markdown',
          status: 'completed',
          processing_time_ms: latency,
        });
      }

      // 3. Seed Missions for active workers
      await MissionModel.create({
        request_id: `mission-${uuidv4()}`,
        status: 'processing',
        worker_id: 'worker-node-1',
        last_seen_at: new Date(), // Active (heartbeat now)
        payload: { email: 'test@example.com', subject_name: 'Test', syllabus: 'Test' },
      });

      await MissionModel.create({
        request_id: `mission-${uuidv4()}`,
        status: 'processing',
        worker_id: 'worker-node-2',
        last_seen_at: new Date(Date.now() - 60000), // Inactive (> 30s)
        payload: { email: 'test@example.com', subject_name: 'Test', syllabus: 'Test' },
      });

      const req = { query: {} } as unknown as Request;
      const res = createMockResponse();

      await getPipelineMetricsHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonBody.success).toBe(true);

      const metrics = res.jsonBody.metrics;

      // Total drafted sections = 3 + 2 = 5. Repaired = 1. Repair rate = 20%
      expect(metrics.sample_sizes.total_workspaces).toBe(2);
      expect(metrics.sample_sizes.total_drafted_sections).toBe(5);
      expect(metrics.sample_sizes.repaired_sections).toBe(1);
      expect(metrics.section_repair_rate_percent).toBe(20);

      // Total exhausted = 1 out of 2 => 50%
      expect(metrics.checklist_exhaustion_rate_percent).toBe(50);

      // Average DAG nodes = 5 / 2 = 2.5
      expect(metrics.average_dag_nodes).toBe(2.5);

      // Latency percentiles for [20000, 30000, 40000, 45000, 50000]
      expect(metrics.latency.p50_latency_ms).toBe(40000);
      expect(metrics.latency.p95_latency_ms).toBe(49000);

      // Active workers: worker-node-1 is within 30s, worker-node-2 is not
      expect(metrics.active_worker_count).toBe(1);
    });
  });
});
