import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { NotesWorkspaceModel } from '../../src/models/notes-workspace.model.js';
import {
  updateSection,
  pushTerms,
  pushAnchors,
  updateCoverageStatus,
  recordSourcesUsed,
} from '../../src/workspace/workspace-ops.js';
import { v4 as uuidv4 } from 'uuid';

describe('Atomic Workspace Operations', () => {
  const testMissionId = `test-ops-${uuidv4()}`;

  beforeAll(async () => {
    await connectDB();
    await NotesWorkspaceModel.create({
      mission_id: testMissionId,
      syllabus_topics: ['Trees'],
      coverage_checklist: [
        {
          requirement_id: 'req_01',
          syllabus_text: 'Binary Search Trees',
          mapped_section_id: 'sec_01',
          status: 'pending',
        },
      ],
      generated_sections: {},
      terms_defined: [],
      cross_reference_anchors: [],
    });
  });

  afterAll(async () => {
    await NotesWorkspaceModel.deleteMany({ mission_id: testMissionId });
    await disconnectDB();
  });

  it('should atomically update section content', async () => {
    await updateSection(testMissionId, 'sec_01', {
      title: 'Binary Search Trees',
      content_markdown: '## BST Content',
      word_count: 3,
      status: 'completed',
    });

    const doc = await NotesWorkspaceModel.findOne({ mission_id: testMissionId });
    const sec = (doc?.generated_sections as any)?.get?.('sec_01') || (doc?.generated_sections as any)?.sec_01;
    expect(sec).toBeDefined();
    expect(sec.title).toBe('Binary Search Trees');
  });

  it('should push terms and anchors to workspace without overwriting existing', async () => {
    await pushTerms(testMissionId, [
      {
        term: 'BST',
        definition: 'Binary Search Tree',
        introduced_in_section: 'sec_01',
      },
    ]);

    await pushAnchors(testMissionId, [
      {
        anchor_id: 'sec-01-bst',
        section_id: 'sec_01',
        label: 'BST Anchor',
      },
    ]);

    const doc = await NotesWorkspaceModel.findOne({ mission_id: testMissionId });
    expect(doc?.terms_defined.length).toBe(1);
    expect(doc?.terms_defined[0].term).toBe('BST');
    expect(doc?.cross_reference_anchors.length).toBe(1);
    expect(doc?.cross_reference_anchors[0].anchor_id).toBe('sec-01-bst');
  });

  it('should atomically update coverage checklist status', async () => {
    await updateCoverageStatus(testMissionId, 'req_01', 'drafted');

    const doc = await NotesWorkspaceModel.findOne({ mission_id: testMissionId });
    const item = doc?.coverage_checklist.find((c) => c.requirement_id === 'req_01');
    expect(item?.status).toBe('drafted');
  });
});
