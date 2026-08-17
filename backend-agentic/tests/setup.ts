import { inject, vi } from 'vitest';

process.env.NODE_ENV = 'test';

for (const key of [
  'GROQ_API_KEY',
  'GEMINI_API_KEY',
  'SEARCH_API_KEY',
  'CX_KEY',
  'BREVO_API_KEY',
  'OPENCODE_API_KEY',
  'LANGFUSE_PUBLIC_KEY',
  'LANGFUSE_SECRET_KEY',
  'SMTP_HOST',
  'SMTP_MAIL',
  'SMTP_PASSWORD',
  'SMTP_PORT',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_CLIENT_ID',
  'FIREBASE_AUTH_URI',
  'FIREBASE_TOKEN_URI',
  'FIREBASE_AUTH_PROVIDER_CERT_URL',
  'FIREBASE_CLIENT_CERT_URL',
]) {
  process.env[key] = '';
}

process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/pandaprep-test';

const mongoUri = (inject as unknown as (key: string) => string | undefined)('mongoUri') || process.env.TEST_MONGODB_URI;
if (mongoUri) {
  process.env.MONGODB_URI = mongoUri;
}

vi.mock('../../src/agents/llm.js', async () => {
  const { fakeLLM } = await import('./mocks/fake-llm.js');
  return {
    createResilientLLM: () => fakeLLM,
    getCapableLLM: () => fakeLLM,
    getFastLLM: () => fakeLLM,
    getLLM: () => fakeLLM,
    createDeepSeek: () => fakeLLM,
  };
});

export async function setup(): Promise<void> {}

export async function teardown(): Promise<void> {}