import { AgentCheckpointModel } from '../models/agent-checkpoint.model.js';
import { NotesWorkspaceModel } from '../models/notes-workspace.model.js';
import { AgentState } from './state.js';
import { logger } from '../config/logger.js';
import { v4 as uuidv4 } from 'uuid';

export class MongoAgentCheckpointer {
  /**
   * Persists a snapshot of the agent state to both `agent_checkpoints` and `notes_workspaces`.
   */
  async saveCheckpoint(
    missionId: string,
    node: string,
    state: Partial<AgentState>,
    parentCheckpointId: string | null = null
  ): Promise<string | null> {
    const checkpointId = uuidv4();

    try {
      // 1. Save node execution step in agent_checkpoints
      await AgentCheckpointModel.create({
        thread_id: missionId,
        checkpoint_id: checkpointId,
        parent_checkpoint_id: parentCheckpointId,
        node,
        state,
        metadata: {
          timestamp: new Date(),
          node,
        },
      });

      // 2. Sync working memory state to notes_workspaces collection
      const setOnInsert: Record<string, unknown> = {
        mission_id: missionId,
        createdAt: new Date(),
      };

      if (state.userId) {
        setOnInsert.user_id = state.userId;
      }

      await NotesWorkspaceModel.findOneAndUpdate(
        { mission_id: missionId },
        {
          $set: {
            syllabus_topics: state.syllabusTopics || [],
            topic_graph: state.topicGraph || { nodes: [], edges: [] },
            coverage_checklist: state.coverageChecklist || [],
            generated_sections: state.generatedSections || {},
            final_markdown: state.finalMarkdown || '',
            terms_defined: state.termsDefined || [],
            cross_reference_anchors: state.crossReferenceAnchors || [],
            style_decisions: state.styleDecisions || {},
            sources_used: state.sourcesUsed || {},
            verification_results: state.verificationResults || [],
            outstanding_gaps: state.outstandingGaps || [],
            updatedAt: new Date(),
          },
          $setOnInsert: setOnInsert,
        },
        { upsert: true, new: true }
      );

      logger.debug({ missionId, node, checkpointId }, 'Saved agent checkpoint to MongoDB');
      return checkpointId;
    } catch (error) {
      // Save failures must never fail a mission: log and continue without a checkpoint.
      logger.error({ err: error, missionId, node }, 'Failed to save agent checkpoint to MongoDB; continuing without checkpoint');
      return null;
    }
  }

  /**
   * Loads the latest checkpoint state and node name for a given mission.
   */
  async loadLatestCheckpoint(
    missionId: string
  ): Promise<{ state: Record<string, unknown>; node: string } | null> {
    try {
      const latest = await AgentCheckpointModel.findOne({ thread_id: missionId })
        .sort({ createdAt: -1 })
        .lean();

      if (!latest) return null;
      return {
        state: latest.state as Record<string, unknown>,
        node: latest.node || 'unknown',
      };
    } catch (error) {
      logger.error({ err: error, missionId }, 'Failed to load latest checkpoint from MongoDB');
      return null;
    }
  }
}

export const mongoCheckpointer = new MongoAgentCheckpointer();
