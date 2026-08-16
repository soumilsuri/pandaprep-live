import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import '../mocks/llm.js';
import { setLLMResponse } from '../mocks/fake-llm.js';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { NotesRequestModel } from '../../src/models/notes-request.model.js';
import { MissionModel } from '../../src/models/mission.model.js';
import { defaultWorker } from '../../src/queue/worker.js';
import { claimNextMission } from '../../src/queue/claim.js';
import { v4 as uuidv4 } from 'uuid';

setLLMResponse('Intake Resolution Agent', {
  depth: 'detailed',
  tone: 'academic_rigorous',
  math_format: 'latex_mathjax',
  include_code_examples: true,
  primary_language: 'English',
  focus_areas: ['Normalization anomalies', 'ACID properties'],
  special_instructions: 'Emphasize normalization and transaction semantics.',
});

setLLMResponse('Lead Syllabus Planner', {
  topic_graph: {
    nodes: [
      {
        section_id: 'sec_01',
        title: 'Relational Algebra and SQL',
        estimated_words: 500,
        key_concepts: ['Relational algebra operators', 'SQL queries', 'Joins'],
      },
      {
        section_id: 'sec_02',
        title: 'Normalization (1NF, 2NF, 3NF, BCNF)',
        estimated_words: 500,
        key_concepts: ['Functional dependencies', 'Anomalies', 'Normal forms'],
      },
      {
        section_id: 'sec_03',
        title: 'Transactions and ACID Properties',
        estimated_words: 500,
        key_concepts: ['Atomicity', 'Consistency', 'Isolation', 'Durability'],
      },
    ],
    edges: [
      { from: 'sec_01', to: 'sec_02', relationship: 'prerequisite' },
      { from: 'sec_02', to: 'sec_03', relationship: 'prerequisite' },
    ],
  },
  coverage_checklist: [
    {
      requirement_id: 'req_01',
      syllabus_text: 'Unit 1: Relational Algebra and SQL',
      mapped_section_id: 'sec_01',
      status: 'pending',
    },
    {
      requirement_id: 'req_02',
      syllabus_text: 'Unit 2: Normalization (1NF, 2NF, 3NF, BCNF)',
      mapped_section_id: 'sec_02',
      status: 'pending',
    },
    {
      requirement_id: 'req_03',
      syllabus_text: 'Unit 3: Transactions and ACID Properties',
      mapped_section_id: 'sec_03',
      status: 'pending',
    },
  ],
  style_decisions: {
    depth: 'detailed',
    tone: 'academic_rigorous',
    include_code_examples: true,
  },
});

setLLMResponse('Section Writer', {
  content_markdown:
    '## Database Management Systems\n\nThis section covers the key concepts of the syllabus unit including normalization and relational algebra.\n\n- Functional dependencies and anomalies are analyzed systematically.\n- Normal forms 1NF, 2NF, 3NF and BCNF are applied step by step.\n\n$$\\text{Query Cost: } O(n \\log n)$$\n\nTransactions guarantee atomicity, consistency, isolation, and durability properties.',
  new_terms_defined: [
    {
      term: 'Functional Dependency',
      definition: 'A constraint that determines attribute values from other attributes.',
    },
  ],
  new_anchors: [{ anchor_id: 'sec-01-fd', label: 'Functional Dependency' }],
});

setLLMResponse('Automated Verifier Agent', {
  passed: true,
  checks: {
    coverage: 'pass',
    missing_topics: 'pass',
    terminology: 'pass',
    grounding: 'pass',
  },
  issues: [],
});

describe('API Contract & Pipeline End-to-End Flow', () => {
  const testRequestId = `test-api-req-${uuidv4()}`;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await NotesRequestModel.deleteMany({ requestId: testRequestId });
    await MissionModel.deleteMany({ request_id: testRequestId });
    await disconnectDB();
  });

  it('should create queued mission and process through worker loop', async () => {
    // 1. Simulate API intake creation (NotesRequest + Mission)
    const userRequest = await NotesRequestModel.create({
      requestId: testRequestId,
      type: 'pdf_generation',
      subject_name: 'Database Management Systems',
      display_name: 'DBMS Revision Notes',
      syllabus: 'Unit 1: Relational Algebra and SQL\nUnit 2: Normalization (1NF, 2NF, 3NF, BCNF)\nUnit 3: Transactions and ACID Properties',
      note_type: 'detailed',
      education_level: 'intermediate',
      include_examples: 'yes',
      user_instructions: 'Focus on normalization anomalies',
      format: 'markdown',
      status: 'queued',
    });

    const mission = await MissionModel.create({
      request_id: testRequestId,
      status: 'queued',
      next_attempt_at: new Date(),
      payload: {
        email: 'student@example.com',
        subject_name: userRequest.subject_name,
        syllabus: userRequest.syllabus,
        note_type: userRequest.note_type,
        education_level: userRequest.education_level,
        include_examples: userRequest.include_examples,
        user_instructions: userRequest.user_instructions,
        format: userRequest.format,
      },
    });

    expect(userRequest.status).toBe('queued');
    expect(mission.status).toBe('queued');

    // 2. Claim and process mission with worker (matches production worker loop)
    const claimedMission = await claimNextMission(defaultWorker.workerId);
    expect(claimedMission).toBeDefined();
    expect(claimedMission?.request_id).toBe(testRequestId);
    await defaultWorker.processMission(claimedMission!);

    // 3. Verify NotesRequestModel is completed with markdown content
    const updatedRequest = await NotesRequestModel.findOne({ requestId: testRequestId });
    expect(updatedRequest).toBeDefined();
    expect(updatedRequest?.status).toBe('completed');
    expect(updatedRequest?.markdown_content).toBeDefined();
    expect(updatedRequest?.markdown_content).toContain('# Database Management Systems Revision Notes');
    expect(updatedRequest?.markdown_content).toContain('Normalization');
    expect(updatedRequest?.processing_time_ms).toBeGreaterThan(0);

    // 4. Verify Mission status is completed
    const updatedMission = await MissionModel.findOne({ request_id: testRequestId });
    expect(updatedMission?.status).toBe('completed');
  });
});
