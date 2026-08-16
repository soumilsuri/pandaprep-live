import { describe, it, expect, vi } from 'vitest';
import { CallbackHandler } from 'langfuse-langchain';

describe('Pillar 1: Langfuse Span Telemetry Hook', () => {
  it('should instantiate Langfuse CallbackHandler with sessionId, userId, and tags', () => {
    const handler = new CallbackHandler({
      publicKey: 'pk-lf-test-12345',
      secretKey: 'sk-lf-test-12345',
      baseUrl: 'https://cloud.langfuse.com',
      sessionId: 'mission-uuid-999',
      userId: 'user-456',
      tags: ['detailed', 'test'],
    });

    expect(handler).toBeDefined();
    expect(handler.sessionId).toBe('mission-uuid-999');
    expect(handler.userId).toBe('user-456');
    expect(handler.tags).toContain('detailed');
    expect(handler.tags).toContain('test');
  });

  it('should handle optional userId gracefully when user is anonymous', () => {
    const handler = new CallbackHandler({
      publicKey: 'pk-lf-test-12345',
      secretKey: 'sk-lf-test-12345',
      baseUrl: 'https://cloud.langfuse.com',
      sessionId: 'mission-uuid-anonymous',
      userId: undefined,
      tags: ['concise', 'production'],
    });

    expect(handler).toBeDefined();
    expect(handler.sessionId).toBe('mission-uuid-anonymous');
    expect(handler.userId).toBeUndefined();
    expect(handler.tags).toEqual(['concise', 'production']);
  });
});
