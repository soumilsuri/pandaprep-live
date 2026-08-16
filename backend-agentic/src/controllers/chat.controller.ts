import { Request, Response } from 'express';
import { z } from 'zod';
import { NotesWorkspaceModel } from '../models/notes-workspace.model.js';
import { NotesRequestModel } from '../models/notes-request.model.js';
import { ChatHistoryModel } from '../models/chat-history.model.js';
import { runQAAgent, QAMessage } from '../agents/qa.agent.js';
import { logger } from '../config/logger.js';

const MAX_QUERY_CHARS = 8000;
const MAX_HISTORY_MESSAGES = 100;
const MAX_HISTORY_LIMIT = 200;

const chatBodySchema = z
  .object({
    missionId: z.string().min(1).max(200).optional(),
    requestId: z.string().min(1).max(200).optional(),
    query: z.string().min(1).max(MAX_QUERY_CHARS),
    message: z.string().min(1).max(MAX_QUERY_CHARS).optional(),
  })
  .refine((d) => d.missionId || d.requestId, 'Either missionId or requestId is required');

export async function chatWithNotesHandler(req: Request, res: Response) {
  const parseResult = chatBodySchema.safeParse({
    ...req.body,
    query: req.body.query ?? req.body.message,
  });

  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request payload',
      details: parseResult.error.flatten(),
    });
  }

  const data = parseResult.data;
  const missionId = (data.missionId || data.requestId)!;
  const userMessage = data.query;
  const userId = req.user?.uid || 'anonymous';

  try {
    // 1. Retrieve workspace or notes request
    const workspace = await NotesWorkspaceModel.findOne({ mission_id: missionId }).lean();
    const notesRequest = !workspace
      ? await NotesRequestModel.findOne({ requestId: missionId }).lean()
      : null;

    if (!workspace && !notesRequest) {
      return res.status(404).json({
        success: false,
        error: 'Revision notes not found for the specified ID',
      });
    }

    const isOwner = workspace
      ? workspace.user_id === userId
      : notesRequest?.user_id === userId;

    if (!isOwner) {
      return res.status(404).json({
        success: false,
        error: 'Revision notes not found for the specified ID',
      });
    }

    const subjectName =
      notesRequest?.subject_name ||
      workspace?.syllabus_topics?.[0] ||
      'Revision Notes';

    const notesMarkdown =
      workspace?.final_markdown ||
      notesRequest?.markdown_content ||
      Object.values(workspace?.generated_sections || {})
        .map((s) => s.content_markdown || '')
        .join('\n\n---\n\n') ||
      '';

    const workspaceTerms = workspace?.terms_defined || [];

    // 2. Fetch existing chat history for multi-turn context
    const existingHistory = await ChatHistoryModel.findOne({
      user_id: userId,
      mission_id: missionId,
    }).lean();

    const formattedHistory: QAMessage[] = (existingHistory?.messages || []).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // 3. Run Q&A Agent
    const qaResult = await runQAAgent({
      subject_name: subjectName,
      notes_markdown: notesMarkdown,
      user_message: userMessage,
      chat_history: formattedHistory,
      workspace_terms: workspaceTerms,
    });

    // 4. Persist turn to ChatHistoryModel
    const newMessages = [
      {
        role: 'user' as const,
        content: userMessage,
        timestamp: new Date(),
      },
      {
        role: 'assistant' as const,
        content: qaResult.reply,
        sources: qaResult.sources.map((s) => ({ section: s })),
        timestamp: new Date(),
      },
    ];

    await ChatHistoryModel.findOneAndUpdate(
      { user_id: userId, mission_id: missionId },
      {
        $push: {
          messages: { $each: newMessages, $slice: -MAX_HISTORY_MESSAGES },
        },
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      reply: qaResult.reply,
      response: qaResult.reply, // backwards compatibility
      sources: qaResult.sources,
      suggested_followups: qaResult.suggested_followups,
    });
  } catch (error: any) {
    logger.error({ err: error, missionId, correlationId: req.correlationId }, 'Error handling chat with notes');
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
    });
  }
}

export async function getChatHistoryHandler(req: Request, res: Response) {
  const missionId = req.params.missionId || req.params.requestId;
  const userId = req.user?.uid || 'anonymous';

  if (!missionId) {
    return res.status(400).json({
      success: false,
      error: 'missionId parameter is required',
    });
  }

  const rawLimit = typeof req.query?.limit === 'string' ? Number.parseInt(req.query.limit, 10) : NaN;
  const rawOffset = typeof req.query?.offset === 'string' ? Number.parseInt(req.query.offset, 10) : NaN;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_HISTORY_LIMIT) : MAX_HISTORY_MESSAGES;
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0;

  try {
    const history = await ChatHistoryModel.findOne({
      user_id: userId,
      mission_id: missionId,
    }).lean();

    const messages = history?.messages || [];
    return res.status(200).json({
      success: true,
      mission_id: missionId,
      messages: messages.slice(offset, offset + limit),
    });
  } catch (error: any) {
    logger.error({ err: error, missionId, correlationId: req.correlationId }, 'Error fetching chat history');
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
    });
  }
}
