import { ChatOpenAI } from '@langchain/openai';
import { ChatGroq } from '@langchain/groq';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { env } from '../config/env.js';

/**
 * Creates an LLM client with Google Gemini 3.5 Flash Lite as the primary engine,
 * cascading automatically to Groq (openai/gpt-oss-20b) as Fallback 1,
 * and OpenCode Zen (deepseek-v4-flash-free) as Fallback 2.
 */
export function createResilientLLM(temperature = 0.2): BaseChatModel {
  const geminiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || 'dummy-gemini-key';
  const groqKey = env.GROQ_API_KEY || process.env.GROQ_API_KEY;
  const opencodeKey = env.OPENCODE_API_KEY || process.env.OPENCODE_API_KEY || 'opencode-key';
  const opencodeBaseURL = env.OPENCODE_BASE_URL || process.env.OPENCODE_BASE_URL || 'https://opencode.ai/zen/v1';

  // 1. Primary: Google Gemini 3.5 Flash Lite
  const primary = new ChatGoogleGenerativeAI({
    apiKey: geminiKey,
    model: 'gemini-3.5-flash-lite',
    temperature,
    maxRetries: 1,
  });

  const fallbacks: BaseChatModel[] = [];

  // 2. Fallback 1: Groq openai/gpt-oss-20b
  if (groqKey) {
    const groqFallback = new ChatGroq({
      apiKey: groqKey,
      model: 'openai/gpt-oss-20b',
      temperature,
      maxRetries: 1,
    });
    fallbacks.push(groqFallback as unknown as BaseChatModel);
  }

  // 3. Fallback 2: DeepSeek V4 Flash Free via OpenCode Zen
  if (opencodeKey) {
    const deepseekFallback = new ChatOpenAI({
      modelName: 'deepseek-v4-flash-free',
      temperature,
      maxRetries: 1,
      timeout: 45000,
      configuration: {
        baseURL: opencodeBaseURL,
        apiKey: opencodeKey,
        timeout: 45000,
      },
    });
    fallbacks.push(deepseekFallback as unknown as BaseChatModel);
  }

  if (fallbacks.length > 0) {
    return primary.withFallbacks(fallbacks) as unknown as BaseChatModel;
  }

  return primary as unknown as BaseChatModel;
}

/**
 * Returns a capable LLM configured with Gemini 3.5 Flash Lite primary + Groq & DeepSeek fallbacks.
 * Default temperature: 0.2 for creative drafting, planning, and repair.
 */
export function getCapableLLM(options?: { temperature?: number }): BaseChatModel {
  const temperature = options?.temperature ?? 0.2;
  return createResilientLLM(temperature);
}

/**
 * Returns a fast/deterministic LLM configured with Gemini 3.5 Flash Lite primary + Groq & DeepSeek fallbacks.
 * Default temperature: 0.0 for deterministic verification and intake parsing.
 */
export function getFastLLM(options?: { temperature?: number }): BaseChatModel {
  const temperature = options?.temperature ?? 0.0;
  return createResilientLLM(temperature);
}

/**
 * Universal getter for backward compatibility.
 */
export function getLLM(tier: 'capable' | 'fast', options?: { temperature?: number }): BaseChatModel {
  return tier === 'capable' ? getCapableLLM(options) : getFastLLM(options);
}

/**
 * Creates a standalone ChatOpenAI instance pointing to DeepSeek V4 Flash Free via OpenCode Zen.
 */
export function createDeepSeek(temperature = 0.2): ChatOpenAI {
  const opencodeKey = env.OPENCODE_API_KEY || process.env.OPENCODE_API_KEY || 'opencode-key';
  const opencodeBaseURL = env.OPENCODE_BASE_URL || process.env.OPENCODE_BASE_URL || 'https://opencode.ai/zen/v1';

  return new ChatOpenAI({
    modelName: 'deepseek-v4-flash-free',
    temperature,
    maxRetries: 1,
    timeout: 45000,
    configuration: {
      baseURL: opencodeBaseURL,
      apiKey: opencodeKey,
      timeout: 45000,
    },
  });
}