import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import '../mocks/llm.js';
import { setLLMResponse } from '../mocks/fake-llm.js';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { NotesWorkspaceModel } from '../../src/models/notes-workspace.model.js';
import { ChatHistoryModel } from '../../src/models/chat-history.model.js';
import { v4 as uuidv4 } from 'uuid';

setLLMResponse('PandaPrep AI', {
  reply: 'A concise answer.',
  sources: ['Some Section'],
  suggested_followups: ['Next question'],
});

describe('Chat Input Bounds & History Pagination (WR-014, WR-015)', () => {
  const testUserId = 'chat-input-user';
  const paginationMissionId = `chat-input-pag-${uuidv4()}`;
  const capMissionId = `chat-input-cap-${uuidv4()}`;
  const aliasMissionId = `chat-input-alias-${uuidv4()}`;
  const sliceMissionId = `chat-input-slice-${uuidv4()}`;
  const missionIds = [paginationMissionId, capMissionId, aliasMissionId, sliceMissionId];

  beforeAll(async () => {
    await connectDB();

    await NotesWorkspaceModel.create({
      mission_id: aliasMissionId,
      user_id: testUserId,
      syllabus_topics: ['Graph Theory'],
      topic_graph: { nodes: [], edges: [] },
      coverage_checklist: [],
      final_markdown: '# Revision Notes\n\nContent.',
    });

    await NotesWorkspaceModel.create({
      mission_id: sliceMissionId,
      user_id: testUserId,
      syllabus_topics: ['Graph Theory'],
      topic_graph: { nodes: [], edges: [] },
      coverage_checklist: [],
      final_markdown: '# Revision Notes\n\nContent.',
    });
  });

  afterAll(async () => {
    await NotesWorkspaceModel.deleteMany({ mission_id: { $in: missionIds } });
    await ChatHistoryModel.deleteMany({ mission_id: { $in: missionIds } });
    await disconnectDB();
  });

  function makeRes() {
    let statusCode = 200;
    let responseData: any = null;
    const res: any = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        responseData = data;
        return this;
      },
    };
    return { res, getStatus: () => statusCode, getData: () => responseData };
  }

  it('rejects an oversized query (>8000 chars) with 400 and validation details', async () => {
    const { chatWithNotesHandler } = await import('../../src/controllers/chat.controller.js');
    const { res, getStatus, getData } = makeRes();
    const req: any = {
      body: { missionId: paginationMissionId, query: 'x'.repeat(8001) },
      user: { uid: testUserId },
    };

    await chatWithNotesHandler(req, res);

    expect(getStatus()).toBe(400);
    expect(getData().success).toBe(false);
    expect(getData().error).toBe('Invalid request payload');
    expect(getData().details).toBeDefined();
  });

  it('rejects a body with neither missionId nor requestId', async () => {
    const { chatWithNotesHandler } = await import('../../src/controllers/chat.controller.js');
    const { res, getStatus, getData } = makeRes();
    const req: any = {
      body: { query: 'What is a graph?' },
      user: { uid: testUserId },
    };

    await chatWithNotesHandler(req, res);

    expect(getStatus()).toBe(400);
    expect(getData().success).toBe(false);
    expect(getData().error).toBe('Invalid request payload');
    expect(getData().details).toBeDefined();
  });

  it('accepts the legacy message field as an alias for query', async () => {
    const { chatWithNotesHandler } = await import('../../src/controllers/chat.controller.js');
    const { res, getStatus, getData } = makeRes();
    const req: any = {
      body: { missionId: aliasMissionId, message: 'Explain shortest paths' },
      user: { uid: testUserId },
    };

    await chatWithNotesHandler(req, res);

    expect(getStatus()).toBe(200);
    expect(getData().success).toBe(true);
    expect(getData().reply).toBe('A concise answer.');

    const historyDoc = await ChatHistoryModel.findOne({
      user_id: testUserId,
      mission_id: aliasMissionId,
    });
    expect(historyDoc?.messages[0].content).toBe('Explain shortest paths');
  });

  it('paginates chat history via limit/offset query params', async () => {
    const messages = Array.from({ length: 25 }, (_, i) => ({
      role: 'user' as const,
      content: `message ${i}`,
      timestamp: new Date(Date.now() + i),
    }));
    await ChatHistoryModel.create({
      user_id: testUserId,
      mission_id: paginationMissionId,
      messages,
    });

    const { getChatHistoryHandler } = await import('../../src/controllers/chat.controller.js');
    const { res, getStatus, getData } = makeRes();
    const req: any = {
      params: { missionId: paginationMissionId },
      query: { limit: '10', offset: '15' },
      user: { uid: testUserId },
    };

    await getChatHistoryHandler(req, res);

    expect(getStatus()).toBe(200);
    expect(getData().success).toBe(true);
    expect(getData().messages.length).toBe(10);
    expect(getData().messages[0].content).toBe('message 15');
    expect(getData().messages[9].content).toBe('message 24');
  });

  it('returns at most 100 messages by default for a large history', async () => {
    const messages = Array.from({ length: 120 }, (_, i) => ({
      role: 'user' as const,
      content: `bulk ${i}`,
      timestamp: new Date(Date.now() + i),
    }));
    await ChatHistoryModel.create({
      user_id: testUserId,
      mission_id: capMissionId,
      messages,
    });

    const { getChatHistoryHandler } = await import('../../src/controllers/chat.controller.js');
    const { res, getStatus, getData } = makeRes();
    const req: any = {
      params: { missionId: capMissionId },
      user: { uid: testUserId },
    };

    await getChatHistoryHandler(req, res);

    expect(getStatus()).toBe(200);
    expect(getData().messages.length).toBe(100);
    expect(getData().messages[0].content).toBe('bulk 0');
    expect(getData().messages[99].content).toBe('bulk 99');
  });

  it('caps persisted history at the last 100 messages via $slice', async () => {
    const { chatWithNotesHandler } = await import('../../src/controllers/chat.controller.js');
    const { res } = makeRes();
    const req: any = {
      body: { missionId: sliceMissionId, query: 'repeat question' },
      user: { uid: testUserId },
    };

    for (let i = 0; i < 51; i++) {
      await chatWithNotesHandler(req, res);
    }

    const historyDoc = await ChatHistoryModel.findOne({
      user_id: testUserId,
      mission_id: sliceMissionId,
    });
    expect(historyDoc).toBeDefined();
    expect(historyDoc?.messages.length).toBe(100);
    expect(historyDoc?.messages[0].content).toBe('repeat question');
    expect(historyDoc?.messages[99].content).toBe('A concise answer.');
  });
});