import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import '../mocks/llm.js';
import { setLLMResponse } from '../mocks/fake-llm.js';
import app from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { NotesWorkspaceModel } from '../../src/models/notes-workspace.model.js';
import { ChatHistoryModel } from '../../src/models/chat-history.model.js';
import { v4 as uuidv4 } from 'uuid';

setLLMResponse('PandaPrep AI', {
  reply:
    '**Relaxation** is the operation that updates the distance estimate to a vertex when a shorter path is discovered. In Dijkstra algorithm it is performed when the computed path through the current vertex improves the known distance: if $d(u) + w(u, v) < d(v)$ then $d(v)$ is relaxed to the smaller value. The time complexity of Dijkstra with a binary heap is $O((V + E) \\log V)$.',
  sources: ['Dijkstra Algorithm'],
  suggested_followups: [
    'Quiz me on shortest paths',
    'Explain priority queues',
    'What happens with negative edge weights?',
  ],
});

describe('Chat API & Multi-turn Conversation', () => {
  const testMissionId = `chat-test-${uuidv4()}`;

  beforeAll(async () => {
    await connectDB();

    await NotesWorkspaceModel.create({
      mission_id: testMissionId,
      user_id: 'test-student-99',
      syllabus_topics: ['Graph Theory'],
      topic_graph: {
        nodes: [
          {
            section_id: 'sec_01',
            title: 'Dijkstra Algorithm',
            key_concepts: ['Shortest Path', 'Priority Queue', 'Relaxation'],
          },
        ],
        edges: [],
      },
      coverage_checklist: [],
      final_markdown: `# Graph Theory Revision Notes\n\n## Dijkstra Algorithm\nDijkstra algorithm finds single-source shortest paths in non-negative weighted graphs with $\\mathcal{O}((V + E) \\log V)$ complexity.`,
      terms_defined: [
        {
          term: 'Relaxation',
          definition: 'Updating the distance to a vertex if a shorter path is found.',
          introduced_in_section: 'sec_01',
        },
      ],
      cross_reference_anchors: [],
    });
  });

  afterAll(async () => {
    await NotesWorkspaceModel.deleteMany({ mission_id: testMissionId });
    await ChatHistoryModel.deleteMany({ mission_id: testMissionId });
    await disconnectDB();
  });

  it('should answer question and persist conversation turn into ChatHistoryModel', async () => {
    // Send message via express handler directly
    const req: any = {
      body: {
        missionId: testMissionId,
        query: 'What is relaxation in Dijkstra algorithm and what is its time complexity?',
      },
      user: { uid: 'test-student-99' },
    };

    let responseData: any = null;
    let statusCode = 200;

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

    const { chatWithNotesHandler, getChatHistoryHandler } = await import(
      '../../src/controllers/chat.controller.js'
    );

    await chatWithNotesHandler(req, res);

    expect(statusCode).toBe(200);
    expect(responseData).toBeDefined();
    expect(responseData.success).toBe(true);
    expect(responseData.reply).toBeDefined();

    // Verify persistence in ChatHistoryModel
    const historyDoc = await ChatHistoryModel.findOne({
      user_id: 'test-student-99',
      mission_id: testMissionId,
    });
    expect(historyDoc).toBeDefined();
    expect(historyDoc?.messages.length).toBe(2);
    expect(historyDoc?.messages[0].role).toBe('user');
    expect(historyDoc?.messages[1].role).toBe('assistant');

    // Test getChatHistoryHandler
    const getReq: any = {
      params: { missionId: testMissionId },
      user: { uid: 'test-student-99' },
    };
    let getHistoryData: any = null;
    const getRes: any = {
      status(code: number) {
        return this;
      },
      json(data: any) {
        getHistoryData = data;
        return this;
      },
    };

    await getChatHistoryHandler(getReq, getRes);
    expect(getHistoryData).toBeDefined();
    expect(getHistoryData.success).toBe(true);
    expect(getHistoryData.messages.length).toBe(2);
  });
});
