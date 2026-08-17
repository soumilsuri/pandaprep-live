import { Request, Response } from 'express';
import { z } from 'zod';
import { NotesWorkspaceModel } from '../models/notes-workspace.model.js';
import { NotesRequestModel } from '../models/notes-request.model.js';
import { MissionModel } from '../models/mission.model.js';
import { logger } from '../config/logger.js';

export const metricsQuerySchema = z.object({
  window: z.enum(['1h', '24h', '7d', '30d', 'all']).optional().default('all'),
});

export function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (!sortedValues || sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];

  const index = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (upper === lower) return sortedValues[lower];
  return Math.round(sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight);
}

export function parseWindowCutoff(windowParam?: string): Date | null {
  if (!windowParam || windowParam === 'all') return null;

  const now = Date.now();
  if (windowParam === '1h') return new Date(now - 3600 * 1000);
  if (windowParam === '24h') return new Date(now - 24 * 3600 * 1000);
  if (windowParam === '7d') return new Date(now - 7 * 24 * 3600 * 1000);
  if (windowParam === '30d') return new Date(now - 30 * 24 * 3600 * 1000);

  return null;
}

/**
 * Controller: GET /api/pipeline/metrics
 * Returns real-time operational health metrics across workspace executions,
 * queue health, latency percentiles, and SLA benchmarks (Pillar 2).
 */
export async function getPipelineMetricsHandler(req: Request, res: Response) {
  try {
    const parseResult = metricsQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: parseResult.error.flatten(),
      });
    }

    const { window: windowParam } = parseResult.data;
    const cutoffDate = parseWindowCutoff(windowParam);

    const workspaceFilter: Record<string, unknown> = {};
    const requestFilter: Record<string, unknown> = {
      status: 'completed',
      processing_time_ms: { $exists: true, $ne: null, $gt: 0 },
    };

    if (cutoffDate) {
      workspaceFilter.createdAt = { $gte: cutoffDate };
      requestFilter.createdAt = { $gte: cutoffDate };
    }

    // 1. Aggregate AI quality & loop metrics on NotesWorkspaceModel
    const [workspaceAgg] = await NotesWorkspaceModel.aggregate([
      { $match: workspaceFilter },
      {
        $project: {
          dag_node_count: { $size: { $ifNull: ['$topic_graph.nodes', []] } },
          has_exhausted_gaps: {
            $cond: [{ $gt: [{ $size: { $ifNull: ['$outstanding_gaps', []] } }, 0] }, 1, 0],
          },
          drafted_sections_count: {
            $max: [
              { $size: { $ifNull: ['$topic_graph.nodes', []] } },
              { $size: { $objectToArray: { $ifNull: ['$generated_sections', {}] } } },
            ],
          },
          repaired_sections_count: {
            $size: {
              $filter: {
                input: { $ifNull: ['$verification_results', []] },
                as: 'res',
                cond: {
                  $or: [
                    { $eq: ['$$res.passed', false] },
                    { $gt: [{ $ifNull: ['$$res.iteration', 1] }, 1] },
                  ],
                },
              },
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          total_workspaces: { $sum: 1 },
          total_dag_nodes: { $sum: '$dag_node_count' },
          total_exhausted_workspaces: { $sum: '$has_exhausted_gaps' },
          total_drafted_sections: { $sum: '$drafted_sections_count' },
          total_repaired_sections: { $sum: '$repaired_sections_count' },
        },
      },
    ]);

    const totalWorkspaces = workspaceAgg?.total_workspaces || 0;
    const totalDagNodes = workspaceAgg?.total_dag_nodes || 0;
    const totalExhausted = workspaceAgg?.total_exhausted_workspaces || 0;
    const totalDraftedSections = workspaceAgg?.total_drafted_sections || 0;
    const totalRepairedSections = workspaceAgg?.total_repaired_sections || 0;

    const sectionRepairRatePercent =
      totalDraftedSections > 0
        ? Number(((totalRepairedSections / totalDraftedSections) * 100).toFixed(2))
        : 0.0;

    const checklistExhaustionRatePercent =
      totalWorkspaces > 0
        ? Number(((totalExhausted / totalWorkspaces) * 100).toFixed(2))
        : 0.0;

    const averageDagNodes =
      totalWorkspaces > 0
        ? Number((totalDagNodes / totalWorkspaces).toFixed(2))
        : 0.0;

    // 2. Compute Latency Percentiles on NotesRequestModel
    const latencyRecords = await NotesRequestModel.find(
      requestFilter,
      { processing_time_ms: 1, _id: 0 }
    )
      .sort({ processing_time_ms: 1 })
      .lean();

    const latencies = latencyRecords
      .map((r) => r.processing_time_ms)
      .filter((t): t is number => typeof t === 'number' && t > 0);

    const p50LatencyMs = calculatePercentile(latencies, 50);
    const p95LatencyMs = calculatePercentile(latencies, 95);
    const p99LatencyMs = calculatePercentile(latencies, 99);

    // 3. Count Active Workers from MissionModel (heartbeat in last 30s)
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
    const activeWorkers = await MissionModel.distinct('worker_id', {
      status: 'processing',
      last_seen_at: { $gte: thirtySecondsAgo },
      worker_id: { $ne: null },
    });
    const activeWorkerCount = activeWorkers.filter(Boolean).length;

    // 4. Determine overall health status based on SLAs
    const isHealthy =
      sectionRepairRatePercent <= 15.0 &&
      checklistExhaustionRatePercent <= 3.0;

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      window: windowParam,
      metrics: {
        section_repair_rate_percent: sectionRepairRatePercent,
        checklist_exhaustion_rate_percent: checklistExhaustionRatePercent,
        average_dag_nodes: averageDagNodes,
        latency: {
          p50_latency_ms: p50LatencyMs,
          p95_latency_ms: p95LatencyMs,
          p99_latency_ms: p99LatencyMs,
        },
        active_worker_count: activeWorkerCount,
        sample_sizes: {
          total_workspaces: totalWorkspaces,
          total_drafted_sections: totalDraftedSections,
          repaired_sections: totalRepairedSections,
          completed_requests: latencies.length,
        },
        targets: {
          section_repair_rate_percent: '< 15%',
          checklist_exhaustion_rate_percent: '< 3%',
          average_dag_nodes: '8 to 14',
          p95_latency_ms: '< 45000',
        },
        status: isHealthy ? 'healthy' : 'degraded',
      },
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Failed to compute operational pipeline metrics');
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
    });
  }
}
