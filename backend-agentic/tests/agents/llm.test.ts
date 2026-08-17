import { describe, it, expect, vi } from 'vitest';
import { ChatOpenAI } from '@langchain/openai';

describe('LLM Factory — Resilient Multi-Provider & DeepSeek', () => {
  it('should instantiate resilient LLMs and standalone DeepSeek model', async () => {
    // Import actual implementation bypassing mock
    const { getCapableLLM, getFastLLM, getLLM, createDeepSeek, createResilientLLM } =
      await vi.importActual<typeof import('../../src/agents/llm.js')>('../../src/agents/llm.js');

    const capableLLM = getCapableLLM();
    expect(capableLLM).toBeDefined();

    const fastLLM = getFastLLM();
    expect(fastLLM).toBeDefined();

    const capableCompat = getLLM('capable');
    expect(capableCompat).toBeDefined();

    const fastCompat = getLLM('fast');
    expect(fastCompat).toBeDefined();

    const resilientLLM = createResilientLLM(0.5);
    expect(resilientLLM).toBeDefined();

    const customDeepSeek = createDeepSeek(0.7);
    expect(customDeepSeek).toBeInstanceOf(ChatOpenAI);
    expect(customDeepSeek.modelName).toBe('deepseek-v4-flash-free');
    expect(customDeepSeek.temperature).toBe(0.7);
  });
});

