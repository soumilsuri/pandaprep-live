import { describe, it, expect, afterEach, vi } from 'vitest';
import { verifyFirebaseToken } from '../../src/middleware/auth.middleware.js';

function makeRes() {
  let statusCode = 200;
  let body: unknown = null;
  const res: any = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: unknown) {
      body = data;
      return this;
    },
  };
  return { res, getStatus: () => statusCode, getBody: () => body as { error?: string } };
}

describe('Auth middleware (SG-007)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when no Authorization header is present', async () => {
    const req: any = { headers: {} };
    const next = vi.fn();
    const { res, getStatus, getBody } = makeRes();

    await verifyFirebaseToken(req, res, next);

    expect(getStatus()).toBe(401);
    expect(getBody().error).toContain('No authorization token');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for a malformed Authorization header', async () => {
    const req: any = { headers: { authorization: 'Basic abc123' } };
    const next = vi.fn();
    const { res, getStatus } = makeRes();

    await verifyFirebaseToken(req, res, next);

    expect(getStatus()).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('bypasses to the dev-user identity in test env when Firebase Admin is uninitialized', async () => {
    const req: any = { headers: { authorization: 'Bearer some-token' } };
    const next = vi.fn();
    const { res } = makeRes();

    await verifyFirebaseToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({ uid: 'dev-user', email: 'dev@pandaprep.test' });
  });
});