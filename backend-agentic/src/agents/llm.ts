import { ChatOpenAI } from '@langchain/openai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { env } from '../config/env.js';

/**
 * Creates a ChatOpenAI client connected to OpenCode Zen running DeepSeek V4 Flash Free.
 */
export function createDeepSeek(temperature = 0.2): BaseChatModel {
  const apiKey = env.OPENCODE_API_KEY || process.env.OPENCODE_API_KEY || 'opencode-key';
  const baseURL = env.OPENCODE_BASE_URL || process.env.OPENCODE_BASE_URL || 'https://api.opencode.ai/v1';

  return new ChatOpenAI({
    modelName: 'deepseek-v4-flash-free',
    temperature,
    maxRetries: 2,
    configuration: {
      baseURL,
      apiKey,
    },
  });
}

/**
 * Returns a capable LLM configured with DeepSeek V4 Flash Free (OpenCode Zen).
 * Default temperature: 0.2 for creative drafting, planning, and repair.
 */
export function getCapableLLM(options?: { temperature?: number }): BaseChatModel {
  const temperature = options?.temperature ?? 0.2;
  return createDeepSeek(temperature);
}

/**
 * Returns a fast/deterministic LLM configured with DeepSeek V4 Flash Free (OpenCode Zen).
 * Default temperature: 0.0 for deterministic verification and intake parsing.
 */
export function getFastLLM(options?: { temperature?: number }): BaseChatModel {
  const temperature = options?.temperature ?? 0.0;
  return createDeepSeek(temperature);
}

/**
 * Universal getter for backward compatibility.
 */
export function getLLM(tier: 'capable' | 'fast', options?: { temperature?: number }): BaseChatModel {
  return tier === 'capable' ? getCapableLLM(options) : getFastLLM(options);
}