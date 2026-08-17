import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8001),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  OPENCODE_API_KEY: z.string().optional(),
  OPENCODE_BASE_URL: z.string().default('https://opencode.ai/zen/v1'),
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),
  LANGFUSE_HOST: z.string().default('https://cloud.langfuse.com'),
  GROQ_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  SEARCH_API_KEY: z.string().optional(),
  CX_KEY: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_PRIVATE_KEY_ID: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_CLIENT_ID: z.string().optional(),
  FIREBASE_AUTH_URI: z.string().optional(),
  FIREBASE_TOKEN_URI: z.string().optional(),
  FIREBASE_AUTH_PROVIDER_CERT_URL: z.string().optional(),
  FIREBASE_CLIENT_CERT_URL: z.string().optional(),
  BREVO_API_KEY: z.string().optional(),
  FROM_EMAIL: z.string().default('support@pandaprepai.tech'),
  FROM_NAME: z.string().default('Team PandaPrep'),
  SMTP_MAIL: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  CORS_ORIGIN: z.string().optional(),
  ALLOW_PARALLEL_PROCESSING: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
  HEARTBEAT_INTERVAL_MS: z.coerce.number().default(10000),

  SWEEPER_STALE_MS: z.coerce.number().default(45000),
  SWEEPER_INTERVAL_MS: z.coerce.number().default(30000),
  MISSION_MAX_RETRIES: z.coerce.number().default(3),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;
