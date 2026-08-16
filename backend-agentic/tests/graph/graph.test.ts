import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import '../mocks/llm.js';
import { setLLMResponse } from '../mocks/fake-llm.js';
import { notesGenerationGraph } from '../../src/graph/graph.js';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { AgentCheckpointModel } from '../../src/models/agent-checkpoint.model.js';
import { NotesWorkspaceModel } from '../../src/models/notes-workspace.model.js';

setLLMResponse('Intake Resolution Agent', {
  depth: 'detailed',
  tone: 'academic_rigorous',
  math_format: 'latex_mathjax',
  include_code_examples: true,
  primary_language: 'English',
  focus_areas: ['Time complexities', 'Balance factors'],
  special_instructions: 'Emphasize asymptotic analysis and balance conditions.',
});

setLLMResponse('Lead Syllabus Planner', {
  topic_graph: {
    nodes: [
      {
        section_id: 'sec_01',
        title: 'Binary Search Trees',
        estimated_words: 500,
        key_concepts: ['BST invariant', 'Search operations', 'Insertion'],
      },
      {
        section_id: 'sec_02',
        title: 'AVL Trees',
        estimated_words: 500,
        key_concepts: ['Balance factor', 'Rotations', 'Height balancing'],
      },
      {
        section_id: 'sec_03',
        title: 'Graph Algorithms',
        estimated_words: 500,
        key_concepts: ['Graph representations', 'BFS and DFS', 'Shortest paths'],
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
      syllabus_text: 'Unit 1: Binary Search Trees',
      mapped_section_id: 'sec_01',
      status: 'pending',
    },
    {
      requirement_id: 'req_02',
      syllabus_text: 'Unit 2: AVL Trees',
      mapped_section_id: 'sec_02',
      status: 'pending',
    },
    {
      requirement_id: 'req_03',
      syllabus_text: 'Unit 3: Graph Algorithms',
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
    '## Binary Search Trees\n\nA Binary Search Tree (BST) is a node-based binary tree where each node satisfies the BST invariant: left subtree keys are smaller and right subtree keys are larger than the node key.\n\n- Search, insertion, and deletion run in $O(h)$ time where $h$ is the height of the tree.\n- In the worst case a skewed tree gives $h = n$ and $O(n)$ complexity.\n\n$$\\text{Search Complexity: } O(\\log n)$$\n\n### Operations\n\n1. **Search**: compare the target key with the root and recurse into the matching subtree.\n2. **Insert**: navigate to the correct leaf position following the BST invariant.\n3. **Delete**: handle leaf, single-child, and two-child cases using the in-order successor.',
  new_terms_defined: [
    {
      term: 'BST Property',
      definition: 'Left subtree keys are less than the root key; right subtree keys are greater.',
    },
  ],
  new_anchors: [{ anchor_id: 'sec-01-bst-property', label: 'BST Property' }],
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

describe('LangGraph Notes Generation Workflow', () => {
  const testMissionId = `test-mission-${Date.now()}`;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await AgentCheckpointModel.deleteMany({ thread_id: testMissionId });
    await NotesWorkspaceModel.deleteMany({ mission_id: testMissionId });
    await disconnectDB();
  });

  it('should run state graph end-to-end and produce markdown revision notes', async () => {
    const initialState = {
      missionId: testMissionId,
      userId: 'test-user-001',
      email: 'student@example.com',
      subjectName: 'Data Structures & Algorithms',
      syllabus: 'Unit 1: Binary Search Trees\nUnit 2: AVL Trees\nUnit 3: Graph Algorithms',
      userInstructions: 'Focus on time complexities and balance factors',
      noteType: 'detailed' as const,
      educationLevel: 'intermediate' as const,
      includeExamples: 'yes' as const,
      format: 'markdown' as const,
    };

    const finalState = await notesGenerationGraph.invoke(initialState);

    expect(finalState).toBeDefined();
    expect(finalState.status).toBe('completed');
    expect(finalState.topicGraph.nodes.length).toBeGreaterThanOrEqual(3);
    expect(finalState.coverageChecklist.length).toBeGreaterThanOrEqual(3);
    expect(finalState.coverageChecklist.every((c: any) => c.status === 'verified')).toBe(true);
    expect(finalState.finalMarkdown).toContain('# Data Structures & Algorithms Revision Notes');
    expect(finalState.finalMarkdown).toContain('Table of Contents');
    expect(finalState.finalMarkdown).toContain('Binary Search Trees');
  });
});
