import {
  NotesWorkspaceModel,
  IGeneratedSection,
  ITermDefined,
  ICrossReferenceAnchor,
  ISourceUsed,
} from '../models/notes-workspace.model.js';
import { logger } from '../config/logger.js';

export async function updateSection(
  missionId: string,
  sectionId: string,
  sectionData: IGeneratedSection
) {
  try {
    return await NotesWorkspaceModel.updateOne(
      { mission_id: missionId },
      {
        $set: {
          [`generated_sections.${sectionId}`]: {
            ...sectionData,
            updated_at: new Date(),
          },
          updatedAt: new Date(),
        },
      }
    );
  } catch (error) {
    logger.error({ err: error, missionId, sectionId }, 'Failed to atomically update section');
    throw error;
  }
}

export async function pushTerms(missionId: string, terms: ITermDefined[]) {
  if (!terms || terms.length === 0) return;
  try {
    return await NotesWorkspaceModel.updateOne(
      { mission_id: missionId },
      {
        $push: {
          terms_defined: { $each: terms },
        },
        $set: { updatedAt: new Date() },
      }
    );
  } catch (error) {
    logger.error({ err: error, missionId }, 'Failed to push terms to workspace');
    throw error;
  }
}

export async function pushAnchors(missionId: string, anchors: ICrossReferenceAnchor[]) {
  if (!anchors || anchors.length === 0) return;
  try {
    return await NotesWorkspaceModel.updateOne(
      { mission_id: missionId },
      {
        $push: {
          cross_reference_anchors: { $each: anchors },
        },
        $set: { updatedAt: new Date() },
      }
    );
  } catch (error) {
    logger.error({ err: error, missionId }, 'Failed to push anchors to workspace');
    throw error;
  }
}

export async function updateCoverageStatus(
  missionId: string,
  requirementId: string,
  status: 'pending' | 'drafted' | 'verified'
) {
  try {
    return await NotesWorkspaceModel.updateOne(
      { mission_id: missionId, 'coverage_checklist.requirement_id': requirementId },
      {
        $set: {
          'coverage_checklist.$.status': status,
          updatedAt: new Date(),
        },
      }
    );
  } catch (error) {
    logger.error({ err: error, missionId, requirementId }, 'Failed to update coverage checklist status');
    throw error;
  }
}

export async function recordSourcesUsed(
  missionId: string,
  sectionId: string,
  sources: ISourceUsed[]
) {
  if (!sources || sources.length === 0) return;
  try {
    return await NotesWorkspaceModel.updateOne(
      { mission_id: missionId },
      {
        $set: {
          [`sources_used.${sectionId}`]: sources,
          updatedAt: new Date(),
        },
      }
    );
  } catch (error) {
    logger.error({ err: error, missionId, sectionId }, 'Failed to record sources used');
    throw error;
  }
}
