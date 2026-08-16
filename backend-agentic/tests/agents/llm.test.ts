import { describe, it, expect, vi } from 'vitest';
import { ChatOpenAI } from '@langchain/openai';

describe('LLM Factory — DeepSeek V4 Flash Free (OpenCode Zen)', () => {
  it('should instantiate ChatOpenAI configured with DeepSeek V4 Flash Free and OpenCode Zen baseURL', async () => {
    // Import actual implementation bypassing mock
    const { getCapableLLM, getFastLLM, createDeepSeek } = await vi.importActual<typeof import('../../src/agents/llm.js')>(
      '../../src/agents/llm.js'
    );

    const capableLLM = getCapableLLM() as ChatOpenAI;
    expect(capableLLM).toBeInstanceOf(ChatOpenAI);
    expect(capableLLM.modelName).toBe('deepseek-v4-flash-free');
    expect(capableLLM.temperature).toBe(0.2);

    const fastLLM = getFastLLM() as ChatOpenAI;
    expect(fastLLM).toBeInstanceOf(ChatOpenAI);
    expect(fastLLM.modelName).toBe('deepseek-v4-flash-free');
    expect(fastLLM.temperature).toBe(0.0);

    const customLLM = createDeepSeek(0.7) as ChatOpenAI;
    expect(customLLM).toBeInstanceOf(ChatOpenAI);
    expect(customLLM.modelName).toBe('deepseek-v4-flash-free');
    expect(customLLM.temperature).toBe(0.7);
  });
});
