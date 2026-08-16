import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { cosineSimilarity } from '../../src/embeddings/embed.js';
import { searchWeb } from '../../src/tools/search-web.js';
import { finalizeMarkdown } from '../../src/tools/finalize-markdown.js';
import { notifyNotesReady } from '../../src/tools/notify.js';
import { NotesWorkspaceModel } from '../../src/models/notes-workspace.model.js';
import { NotesRequestModel } from '../../src/models/notes-request.model.js';
import { v4 as uuidv4 } from 'uuid';

describe('Tool Registry & Utilities', () => {
  const testMissionId = `reg-test-${uuidv4()}`;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await NotesWorkspaceModel.deleteMany({ mission_id: testMissionId });
    await NotesRequestModel.deleteMany({ requestId: testMissionId });
    await disconnectDB();
  });

  it('should compute cosine similarity', () => {
    const sim = cosineSimilarity([1, 0], [1, 0]);
    expect(sim).toBeCloseTo(1);
  });

  it('should return no results when search API is not configured', async () => {
    const results = await searchWeb('Binary Trees');
    expect(results).toEqual([]);
  });

  it('should finalize markdown and persist to MongoDB', async () => {
    await NotesRequestModel.create({
      requestId: testMissionId,
      type: 'pdf_generation',
      subject_name: 'Computer Science',
      display_name: 'CS Notes',
      syllabus: 'Trees',
      status: 'processing',
    });

    const md = await finalizeMarkdown({
      missionId: testMissionId,
      subjectName: 'Computer Science',
      topicGraph: {
        nodes: [{ section_id: 'sec_01', title: 'Trees', key_concepts: ['Binary Tree'] }],
        edges: [],
      },
      generatedSections: {
        sec_01: { title: 'Trees', content_markdown: '## Trees\nBinary Trees Content', status: 'completed' },
      },
      outstandingGaps: [],
    });

    expect(md).toContain('# Computer Science Revision Notes');
    expect(md).toContain('Table of Contents');

    const req = await NotesRequestModel.findOne({ requestId: testMissionId });
    expect(req?.status).toBe('completed');
  });

  it('should dispatch notification without error', async () => {
    const res = await notifyNotesReady({
      recipientEmail: 'student@example.com',
      subjectName: 'Computer Science',
      requestId: testMissionId,
    });
    expect(res).toBe(true);
  });
});
