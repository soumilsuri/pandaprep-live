import { describe, it, expect, beforeEach } from 'vitest';
import '../mocks/llm.js';
import { setLLMResponse, resetLLMResponses } from '../mocks/fake-llm.js';
import { draftSection } from '../../src/agents/writer.agent.js';

const scopedSlice = (sectionId: string, title: string) => ({
  section_info: {
    section_id: sectionId,
    title,
    estimated_words: 400,
    key_concepts: ['BST property', 'In-order traversal', 'Search operations'],
  },
  style_rules: {
    depth: 'detailed',
    tone: 'academic_rigorous',
    math_format: 'latex_mathjax',
  },
  prerequisite_terms: [],
  available_anchors: [],
  prerequisite_section_titles: [],
});

describe('Writer Agent salvage behavior', () => {
  beforeEach(() => {
    resetLLMResponses();
  });

  it('salvages valid content_markdown when new_terms_defined is malformed', async () => {
    setLLMResponse('Salvage Test', {
      content_markdown: '## Salvage Test\n\nValid content that must be kept.',
      new_terms_defined: 'not-an-array',
      new_anchors: [],
    });

    const result = await draftSection({
      subject_name: 'Data Structures',
      scoped_slice: scopedSlice('sec_10', 'Salvage Test'),
    });

    expect(result.section.content_markdown).toBe('## Salvage Test\n\nValid content that must be kept.');
    expect(result.new_terms_defined).toEqual([]);
    expect(result.section.status).toBe('completed');
  });

  it('does not fabricate chunk source ids', async () => {
    setLLMResponse('Sources Test', {
      content_markdown: '## Sources Test\n\nContent without external chunks.',
      new_terms_defined: [],
      new_anchors: [],
    });

    const result = await draftSection({
      subject_name: 'Data Structures',
      scoped_slice: scopedSlice('sec_11', 'Sources Test'),
    });

    expect(result.sources_used).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('chunk_1');
  });

  it('falls back wholesale only when content_markdown itself is invalid', async () => {
    setLLMResponse('Fallback Test', {
      content_markdown: '',
      new_terms_defined: [{ term: 'Term X', definition: 'Definition Y' }],
      new_anchors: [],
    });

    const result = await draftSection({
      subject_name: 'Data Structures',
      scoped_slice: scopedSlice('sec_12', 'Fallback Test'),
    });

    expect(result.section.content_markdown).toContain('### Overview');
    expect(result.section.status).toBe('completed');
  });
});