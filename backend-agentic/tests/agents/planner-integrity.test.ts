import { describe, it, expect } from 'vitest';
import '../mocks/llm.js';
import { setLLMResponse } from '../mocks/fake-llm.js';
import { runPlannerAgent } from '../../src/agents/planner.agent.js';

setLLMResponse('INTEGRITY-MARKER', {
  topic_graph: {
    nodes: [
      {
        section_id: 'sec_01',
        title: 'Topic A',
        estimated_words: 500,
        key_concepts: ['A'],
      },
      {
        section_id: 'sec_01',
        title: 'Topic A duplicate',
        estimated_words: 500,
        key_concepts: ['A'],
      },
      {
        section_id: 'sec_02',
        title: 'Topic B',
        estimated_words: 500,
        key_concepts: ['B'],
      },
    ],
    edges: [
      { from: 'sec_01', to: 'sec_02', relationship: 'prerequisite' },
      { from: 'sec_01', to: 'sec_99', relationship: 'prerequisite' },
      { from: 'sec_02', to: 'sec_02', relationship: 'prerequisite' },
    ],
  },
  coverage_checklist: [
    {
      requirement_id: 'req_01',
      syllabus_text: 'Topic A',
      mapped_section_id: 'sec_01',
      status: 'pending',
    },
    {
      requirement_id: 'req_02',
      syllabus_text: 'Topic B',
      mapped_section_id: 'sec_02',
      status: 'pending',
    },
    {
      requirement_id: 'req_03',
      syllabus_text: 'Topic C',
      mapped_section_id: 'sec_99',
      status: 'pending',
    },
  ],
  style_decisions: {
    depth: 'detailed',
  },
});

describe('Planner referential integrity sanitization (WR-020)', () => {
  it('drops duplicate node ids, dangling edges, self-loops and orphaned checklist items without throwing', async () => {
    const plan = await runPlannerAgent({
      subject_name: 'Data Structures',
      syllabus: 'INTEGRITY-MARKER\nTopic A\nTopic B',
      note_type: 'detailed',
      education_level: 'intermediate',
    });

    expect(plan).toBeDefined();

    const nodeIds = plan.topic_graph.nodes.map((n) => n.section_id);
    expect(nodeIds).toEqual(['sec_01', 'sec_02']);

    expect(plan.topic_graph.edges).toEqual([
      { from: 'sec_01', to: 'sec_02', relationship: 'prerequisite' },
    ]);

    const requirements = plan.coverage_checklist.map((c) => c.requirement_id);
    expect(requirements).toEqual(['req_01', 'req_02']);
    expect(plan.coverage_checklist.every((c) => c.mapped_section_id !== 'sec_99')).toBe(true);
  });

  it('leaves a valid plan untouched', async () => {
    const plan = await runPlannerAgent({
      subject_name: 'Data Structures',
      syllabus: 'INTEGRITY-MARKER\nOnly Topic',
      note_type: 'detailed',
      education_level: 'intermediate',
    });

    const nodeIds = plan.topic_graph.nodes.map((n) => n.section_id);
    expect(nodeIds).toEqual(['sec_01', 'sec_02']);

    const validEdges = plan.topic_graph.edges.every((e) => nodeIds.includes(e.from) && nodeIds.includes(e.to));
    expect(validEdges).toBe(true);
  });
});