import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import '../mocks/llm.js';
import { resetLLMResponses, setLLMResponse } from '../mocks/fake-llm.js';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { NotesRequestModel } from '../../src/models/notes-request.model.js';
import { MissionModel } from '../../src/models/mission.model.js';
import { NotesWorkspaceModel } from '../../src/models/notes-workspace.model.js';
import { ChatHistoryModel } from '../../src/models/chat-history.model.js';
import { v4 as uuidv4 } from 'uuid';

resetLLMResponses();
setLLMResponse('PandaPrep AI', {
  reply: 'OK reply about AVL',
  sources: ['AVL Trees'],
  suggested_followups: ['x'],
});

describe('Identity & IDOR Protection (CR-001, CR-003, CR-004)', () => {
  const ownerUid = 'user-A';
  const intruderUid = 'user-B';
  const requestId = `idor-req-${uuidv4()}`;
  const workspaceMissionId = `idor-ws-${uuidv4()}`;
  const secretMarkdown = 'SECRET-A';
  const secretWorkspaceMarkdown = 'SECRET-WS';

  let generatedRequestId: string | undefined;

  beforeAll(async () => {
    await connectDB();

    await NotesRequestModel.create({
      user_id: ownerUid,
      requestId,
      type: 'pdf_generation',
      subject_name: 'AVL Trees',
      display_name: 'AVL Trees Notes',
      syllabus: 'Unit 1: Balanced Binary Search Trees',
      note_type: 'detailed',
      status: 'completed',
      markdown_content: secretMarkdown,
    });

    await NotesWorkspaceModel.create({
      mission_id: workspaceMissionId,
      user_id: ownerUid,
      syllabus_topics: ['AVL Trees'],
      topic_graph: { nodes: [], edges: [] },
      coverage_checklist: [],
      final_markdown: secretWorkspaceMarkdown,
    });
  });

  afterAll(async () => {
    await NotesRequestModel.deleteMany({ requestId: { $in: [requestId, generatedRequestId].filter(Boolean) } });
    await MissionModel.deleteMany({ request_id: generatedRequestId });
    await NotesWorkspaceModel.deleteMany({ mission_id: workspaceMissionId });
    await ChatHistoryModel.deleteMany({ mission_id: workspaceMissionId });
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

  it('owner (user-A) can fetch generation status and sees the markdown', async () => {
    const { getGenerationStatusHandler } = await import(
      '../../src/controllers/pipeline.controller.js'
    );
    const { res, getStatus, getData } = makeRes();
    const req: any = { params: { requestId }, user: { uid: ownerUid } };

    await getGenerationStatusHandler(req, res);

    expect(getStatus()).toBe(200);
    expect(getData().success).toBe(true);
    expect(getData().status).toBe('completed');
    expect(getData().markdown).toContain(secretMarkdown);
  });

  it('intruder (user-B) gets 404 on another user\'s requestId and no markdown leaks', async () => {
    const { getGenerationStatusHandler } = await import(
      '../../src/controllers/pipeline.controller.js'
    );
    const { res, getStatus, getData } = makeRes();
    const req: any = { params: { requestId }, user: { uid: intruderUid } };

    await getGenerationStatusHandler(req, res);

    expect(getStatus()).toBe(404);
    expect(getData().success).toBe(false);
    expect(getData().error).toBe('Notes request not found');
    expect(JSON.stringify(getData())).not.toContain(secretMarkdown);
  });

  it('intruder (user-B) gets 404 on another user\'s workspace and no chat history is created', async () => {
    const { chatWithNotesHandler } = await import('../../src/controllers/chat.controller.js');
    const { res, getStatus, getData } = makeRes();
    const req: any = {
      body: { missionId: workspaceMissionId, query: 'What are AVL trees?' },
      user: { uid: intruderUid },
    };

    await chatWithNotesHandler(req, res);

    expect(getStatus()).toBe(404);
    expect(getData().success).toBe(false);
    expect(getData().error).toBe('Revision notes not found for the specified ID');
    expect(JSON.stringify(getData())).not.toContain(secretWorkspaceMarkdown);

    const intruderHistory = await ChatHistoryModel.countDocuments({
      user_id: intruderUid,
      mission_id: workspaceMissionId,
    });
    expect(intruderHistory).toBe(0);
  });

  it('owner (user-A) can chat with their own workspace', async () => {
    const { chatWithNotesHandler } = await import('../../src/controllers/chat.controller.js');
    const { res, getStatus, getData } = makeRes();
    const req: any = {
      body: { missionId: workspaceMissionId, query: 'Explain AVL trees' },
      user: { uid: ownerUid },
    };

    await chatWithNotesHandler(req, res);

    expect(getStatus()).toBe(200);
    expect(getData().success).toBe(true);
    expect(getData().reply).toContain('OK reply about AVL');

    const historyDoc = await ChatHistoryModel.findOne({
      user_id: ownerUid,
      mission_id: workspaceMissionId,
    });
    expect(historyDoc).toBeDefined();
    expect(historyDoc?.messages.length).toBe(2);
  });

  it('generateNotesHandler stores the uid string as user_id (CR-001 regression)', async () => {
    const { generateNotesHandler } = await import(
      '../../src/controllers/pipeline.controller.js'
    );
    const { res, getStatus, getData } = makeRes();
    const req: any = {
      body: {
        email: 'owner-a@example.com',
        syllabus: 'Unit 1: Balanced Binary Search Trees',
        subject_name: 'AVL Trees',
        note_type: 'detailed',
        include_examples: 'no',
        format: 'markdown',
      },
      user: { uid: ownerUid },
    };

    await generateNotesHandler(req, res);

    expect(getStatus()).toBe(202);
    expect(getData().success).toBe(true);
    expect(getData().requestId).toBeDefined();
    generatedRequestId = getData().requestId;

    const createdRequest = await NotesRequestModel.findOne({ requestId: generatedRequestId });
    expect(createdRequest).toBeDefined();
    expect(createdRequest?.user_id).toBe(ownerUid);
    expect(typeof createdRequest?.user_id).toBe('string');

    const createdMission = await MissionModel.findOne({ request_id: generatedRequestId });
    expect(createdMission).toBeDefined();
    expect(createdMission?.user_id).toBe(ownerUid);
    expect(typeof createdMission?.user_id).toBe('string');
  });
});