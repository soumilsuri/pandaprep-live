import { describe, it, expect } from 'vitest';
import '../mocks/llm.js';
import { setLLMResponse } from '../mocks/fake-llm.js';
import { runPlannerAgent } from '../../src/agents/planner.agent.js';
import { runIntakeAgent } from '../../src/agents/intake.agent.js';

setLLMResponse('Intake Resolution Agent', {
  depth: 'detailed',
  tone: 'academic_rigorous',
  math_format: 'latex_mathjax',
  include_code_examples: true,
  primary_language: 'English',
  focus_areas: ['Proofs', 'Time complexities', 'Edge cases'],
  special_instructions: 'Emphasize rigorous proofs and asymptotic analysis.',
});

setLLMResponse('Lead Syllabus Planner', {
  topic_graph: {
    nodes: [
      {
        section_id: 'sec_01',
        title: 'Stacks and Queues',
        estimated_words: 500,
        key_concepts: ['Stack operations', 'Queue operations', 'Deque'],
      },
      {
        section_id: 'sec_02',
        title: 'Trees and Binary Search Trees',
        estimated_words: 500,
        key_concepts: ['Tree traversal', 'BST property', 'Balancing'],
      },
      {
        section_id: 'sec_03',
        title: 'Graphs and Shortest Paths',
        estimated_words: 500,
        key_concepts: ['Graph representations', 'BFS and DFS', 'Dijkstra algorithm'],
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
      syllabus_text: 'Unit 1: Stacks and Queues',
      mapped_section_id: 'sec_01',
      status: 'pending',
    },
    {
      requirement_id: 'req_02',
      syllabus_text: 'Unit 2: Trees and Binary Search Trees',
      mapped_section_id: 'sec_02',
      status: 'pending',
    },
    {
      requirement_id: 'req_03',
      syllabus_text: 'Unit 3: Graphs and Shortest Paths',
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

describe('Intake & Planner Agents', () => {
  it('should parse user instructions into structured style decisions via Intake Agent', async () => {
    const style = await runIntakeAgent({
      education_level: 'advanced',
      note_type: 'detailed',
      user_instructions: 'Focus heavily on proofs, time complexities and edge cases',
      include_examples: 'yes',
    });

    expect(style).toBeDefined();
    expect(style.depth).toBe('detailed');
    expect(style.include_code_examples).toBe(true);
  });

  it('should decompose syllabus into valid topic DAG and coverage checklist via Planner Agent', async () => {
    const plan = await runPlannerAgent({
      subject_name: 'Data Structures',
      syllabus: 'Unit 1: Stacks and Queues\nUnit 2: Trees and Binary Search Trees\nUnit 3: Graphs and Shortest Paths',
      note_type: 'detailed',
      education_level: 'intermediate',
      user_instructions: 'Include asymptotic analysis',
    });

    expect(plan).toBeDefined();
    expect(plan.topic_graph.nodes.length).toBeGreaterThanOrEqual(3);
    expect(plan.coverage_checklist.length).toBeGreaterThanOrEqual(3);
    expect(plan.coverage_checklist.every((c) => c.status === 'pending')).toBe(true);

    // Verify DAG nodes have IDs and key concepts
    for (const node of plan.topic_graph.nodes) {
      expect(node.section_id).toBeDefined();
      expect(node.title).toBeDefined();
      expect(node.key_concepts.length).toBeGreaterThan(0);
    }
  });
});
