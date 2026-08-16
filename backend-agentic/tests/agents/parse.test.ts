import { describe, it, expect } from 'vitest';
import { parseLLMJson, countWords, MAX_NOTES_CONTEXT_CHARS } from '../../src/agents/parse.js';
import { z } from 'zod';

const schema = z.object({ name: z.string(), count: z.number() });

describe('parseLLMJson (SG-001)', () => {
  it('parses plain JSON without fences', () => {
    const result = parseLLMJson('{"name":"x","count":1}', schema);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ name: 'x', count: 1 });
  });

  it('parses ```json fences', () => {
    const result = parseLLMJson('```json\n{"name":"x","count":2}\n```', schema);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.count).toBe(2);
  });

  it('parses ``` json fences with a space after the tag', () => {
    const result = parseLLMJson('``` json\n{"name":"x","count":3}\n```', schema);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.count).toBe(3);
  });

  it('parses ```jsonl fences', () => {
    const result = parseLLMJson('```jsonl\n{"name":"x","count":4}\n```', schema);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.count).toBe(4);
  });

  it('parses fences preceded by LLM commentary', () => {
    const result = parseLLMJson(
      'Here is the generated plan:\n```json\n{"name":"x","count":5}\n```\nHope this helps.',
      schema
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.count).toBe(5);
  });

  it('parses an unclosed fence', () => {
    const result = parseLLMJson('```json\n{"name":"x","count":6}', schema);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.count).toBe(6);
  });

  it('returns ok:false with raw content for malformed JSON', () => {
    const result = parseLLMJson('this is not json at all', schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.raw).toBe('this is not json at all');
      expect(result.error).toBeDefined();
    }
  });

  it('returns ok:false when the payload fails schema validation', () => {
    const result = parseLLMJson('{"name":"x"}', schema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeDefined();
  });
});

describe('countWords (SG-008)', () => {
  it('counts plain text words', () => {
    expect(countWords('one two three four')).toBe(4);
  });

  it('ignores display math blocks', () => {
    const text = 'The complexity is $$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$ in total.';
    expect(countWords(text)).toBe(5);
  });

  it('ignores inline math delimiters', () => {
    const text = 'Search runs in $O(\\log n)$ time for balanced trees.';
    expect(countWords(text)).toBe(7);
  });

  it('ignores fenced code blocks', () => {
    const text = 'Example:\n```bash\nfor i in $(seq 1 10); do echo $i; done\n```\nDone.';
    expect(countWords(text)).toBe(2);
  });

  it('returns 0 for empty or math-only content', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('$$x = 1$$')).toBe(0);
  });
});

describe('MAX_NOTES_CONTEXT_CHARS (SG-004)', () => {
  it('exposes the QA context budget as a named constant', () => {
    expect(MAX_NOTES_CONTEXT_CHARS).toBe(30000);
  });
});