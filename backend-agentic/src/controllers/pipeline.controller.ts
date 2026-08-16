import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { MissionModel } from '../models/mission.model.js';
import { NotesRequestModel } from '../models/notes-request.model.js';
import { logger } from '../config/logger.js';

const ESTIMATED_GENERATION_SECONDS = 45;

const generateNotesSchema = z.object({
  email: z.string().email(),
  syllabus: z.string().min(5, 'Syllabus must be at least 5 characters'),
  subject_name: z.string().min(1, 'Subject name is required'),
  note_type: z.enum(['concise', 'detailed', 'qa']).default('detailed'),
  include_examples: z.enum(['yes', 'no']).default('no'),
  include_images: z.enum(['yes', 'no']).default('no'),
  education_level: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate'),
  user_instructions: z.string().optional().default(''),
  relativePathToReferenceMaterial: z.string().optional().default(''),
  format: z.enum(['markdown', 'pdf']).default('markdown'),
});

export async function generateNotesHandler(req: Request, res: Response) {
  const parseResult = generateNotesSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request payload',
      details: parseResult.error.flatten(),
    });
  }

  const data = parseResult.data;
  const requestId = uuidv4();
  const userId = req.user?.uid;

  const effectiveFormat = data.format === 'pdf' ? 'markdown' : data.format;
  if (data.format === 'pdf') {
    logger.info({ requestId }, "format 'pdf' requested; outputting markdown");
  }
  if (data.include_images === 'yes') {
    logger.info({ requestId }, 'include_images is not yet supported and will be ignored');
  }
  if (data.relativePathToReferenceMaterial) {
    logger.info(
      { requestId, path: data.relativePathToReferenceMaterial },
      'reference material ingestion is not yet supported and will be ignored'
    );
  }

  try {
    // 1. Create UserRequest record in MongoDB (matches existing frontend / history expectations)
    const userRequest = await NotesRequestModel.create({
      user_id: userId,
      requestId,
      type: 'pdf_generation',
      subject_name: data.subject_name,
      display_name: `${data.subject_name} Notes`,
      syllabus: data.syllabus,
      note_type: data.note_type,
      education_level: data.education_level,
      include_examples: data.include_examples,
      user_instructions: data.user_instructions,
      format: effectiveFormat,
      relativePathToReferenceMaterial: data.relativePathToReferenceMaterial,
      status: 'queued',
    });

    // 2. Enqueue mission in atomic missions collection
    const mission = await MissionModel.create({
      request_id: requestId,
      user_id: userId,
      status: 'queued',
      next_attempt_at: new Date(),
      payload: {
        ...data,
        format: effectiveFormat,
      },
    });

    logger.info(
      { requestId, missionId: mission._id, subject: data.subject_name, correlationId: req.correlationId },
      'Notes generation mission queued'
    );

    // 3. Return HTTP 202 Accepted response as specified in API contract
    return res.status(202).json({
      success: true,
      message: 'Notes generation queued',
      requestId,
      jobId: mission._id.toString(),
      estimatedTimeSeconds: ESTIMATED_GENERATION_SECONDS,
    });
  } catch (error: any) {
    logger.error({ err: error, requestId, correlationId: req.correlationId }, 'Failed to queue notes generation mission');
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
    });
  }
}

export async function getGenerationStatusHandler(req: Request, res: Response) {
  const { requestId } = req.params;

  if (!requestId) {
    return res.status(400).json({
      success: false,
      error: 'requestId parameter is required',
    });
  }

  try {
    const userId = req.user?.uid;

    const userRequest = await NotesRequestModel.findOne({
      requestId,
      user_id: userId,
    }).lean();

    if (!userRequest) {
      return res.status(404).json({
        success: false,
        error: 'Notes request not found',
      });
    }

    if (userRequest.status === 'completed') {
      return res.status(200).json({
        success: true,
        status: 'completed',
        error: null,
        markdown: userRequest.markdown_content || null,
        downloadUrl: userRequest.secure_url || null,
        processingTimeMs: userRequest.processing_time_ms || null,
      });
    }

    if (userRequest.status === 'failed') {
      return res.status(200).json({
        success: true,
        status: 'failed',
        error: userRequest.error?.message || 'Notes generation failed',
        markdown: null,
        processingTimeMs: userRequest.processing_time_ms || null,
      });
    }

    // Still processing / queued / pending
    return res.status(200).json({
      success: true,
      status: 'processing',
      error: null,
      markdown: null,
      processingTimeMs: null,
    });
  } catch (error: any) {
    logger.error({ err: error, requestId, correlationId: req.correlationId }, 'Failed to retrieve generation status');
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
    });
  }
}
