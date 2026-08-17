import { describe, it, expect, beforeEach } from 'vitest';
import '../mocks/llm.js';
import { setLLMResponse, resetLLMResponses } from '../mocks/fake-llm.js';
import { runQAAgent } from '../../src/agents/qa.agent.js';

describe('Q&A Agent plural quiz detection', () => {
  const sampleNotes = `# Data Structures Revision Notes

## AVL Trees

An AVL tree is a height-balanced binary search tree where every node satisfies the balance factor condition.
`;

  beforeEach(() => {
    resetLLMResponses();
  });

  it('triggers the quiz instruction path for "MCQs"', async () => {
    setLLMResponse('[Instruction: User is requesting a self-test or quiz.', {
      reply: '**MCQ 1:** What is the balance factor condition in an AVL tree?\n\nAnswer: BF(v) in {-1, 0, 1}.',
      sources: ['AVL Trees'],
      suggested_followups: ['More MCQs', 'Explain rotations'],
    });

    const output = await runQAAgent({
      subject_name: 'Data Structures',
      notes_markdown: sampleNotes,
      user_message: 'Give me MCQs on AVL trees',
    });

    expect(output.reply).toContain('MCQ 1');
  });

  it('triggers the quiz instruction path for "quizzes"', async () => {
    setLLMResponse('[Instruction: User is requesting a self-test or quiz.', {
      reply: '**Quiz:** Balance factor question.',
      sources: ['AVL Trees'],
      suggested_followups: ['Another quiz'],
    });

    const output = await runQAAgent({
      subject_name: 'Data Structures',
      notes_markdown: sampleNotes,
      user_message: 'Give me some quizzes on AVL trees',
    });

    expect(output.reply).toContain('**Quiz:**');
  });

  it('returns the raw LLM content instead of a canned answer when parsing fails', async () => {
    setLLMResponse('Explain AVL trees in plain terms', 'This is not JSON at all. Just raw markdown text.');

    const output = await runQAAgent({
      subject_name: 'Data Structures',
      notes_markdown: sampleNotes,
      user_message: 'Explain AVL trees in plain terms',
    });

    expect(output.reply).toBe('This is not JSON at all. Just raw markdown text.');
    expect(output.reply).not.toContain('Here is the explanation for');
    expect(output.sources).toEqual(['Data Structures']);
  });
});