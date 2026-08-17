import { describe, it, expect, beforeEach } from 'vitest';
import '../mocks/llm.js';
import { setLLMResponse, resetLLMResponses } from '../mocks/fake-llm.js';
import { repairSection } from '../../src/agents/repair.agent.js';

const scopedSlice = (sectionId: string, title: string) => ({
  section_info: {
    section_id: sectionId,
    title,
    key_concepts: ['rotations', 'LR rotation', 'RL rotation'],
  },
  style_rules: {
    depth: 'detailed',
    tone: 'academic_rigorous',
  },
  prerequisite_terms: [],
  available_anchors: [],
  prerequisite_section_titles: [],
});

describe('Repair Agent salvage behavior', () => {
  beforeEach(() => {
    resetLLMResponses();
  });

  it('salvages valid content_markdown when new_terms_defined is malformed', async () => {
    setLLMResponse('AVL Trees', {
      content_markdown: '## AVL Trees\n\nRepaired content that must be kept.',
      new_terms_defined: 'not-an-array',
      new_anchors: [],
    });

    const existingSection = {
      title: 'AVL Trees',
      content_markdown: '## AVL Trees\n\nOld content.',
      status: 'completed' as const,
    };

    const repaired = await repairSection({
      subject_name: 'Data Structures',
      scoped_slice: scopedSlice('sec_02', 'AVL Trees'),
      existing_section: existingSection,
      issues: [
        {
          check: 'coverage',
          severity: 'high' as const,
          description: 'Missing explanation of double rotations (LR and RL).',
          repair_instruction: 'Add a subsection explaining LR and RL double rotations.',
        },
      ],
    });

    expect(repaired.section.content_markdown).toBe('## AVL Trees\n\nRepaired content that must be kept.');
    expect(repaired.new_terms_defined).toEqual([]);
    expect(repaired.section.status).toBe('completed');
  });

  it('preserves the existing section when content_markdown itself is invalid', async () => {
    setLLMResponse('Red-Black Trees', {
      content_markdown: '',
      new_terms_defined: [],
      new_anchors: [],
    });

    const existingSection = {
      title: 'Red-Black Trees',
      content_markdown: '## Red-Black Trees\n\nExisting content.',
      status: 'completed' as const,
    };

    const repaired = await repairSection({
      subject_name: 'Data Structures',
      scoped_slice: scopedSlice('sec_03', 'Red-Black Trees'),
      existing_section: existingSection,
      issues: [],
    });

    expect(repaired.section.content_markdown).toBe(existingSection.content_markdown);
    expect(repaired.new_terms_defined).toEqual([]);
    expect(repaired.new_anchors).toEqual([]);
  });
});