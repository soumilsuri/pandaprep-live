import pino from 'pino';
import { env } from './env.js';

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const usePrettyTransport = env.NODE_ENV === 'development' && !isServerless;

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.NODE_ENV === 'development' ? 'debug' : 'info',
  transport: usePrettyTransport
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    service: 'pandaprep-agentic',
    env: env.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function createChildLogger(requestId: string, extraContext: Record<string, unknown> = {}) {
  return logger.child({
    requestId,
    ...extraContext,
  });
}
