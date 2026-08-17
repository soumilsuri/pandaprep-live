import { vi } from 'vitest';

vi.mock('../../src/agents/llm.js', async () => {
  const { fakeLLM } = await import('./fake-llm.js');
  return {
    getCapableLLM: () => fakeLLM,
    getFastLLM: () => fakeLLM,
    getLLM: () => fakeLLM,
    createDeepSeek: () => fakeLLM,
  };
});

export {};