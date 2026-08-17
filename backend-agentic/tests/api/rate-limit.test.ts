import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { RateLimitModel } from '../../src/models/rate-limit.model.js';
import { createRateLimiter } from '../../src/middleware/rate-limit.middleware.js';
import { v4 as uuidv4 } from 'uuid';

const userIds: string[] = [];

function makeRes() {
  let statusCode = 200;
  let responseData: any = null;
  const res: any = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: any) {
      responseData = data;
      return this;
    },
  };
  return { res, getStatus: () => statusCode, getData: () => responseData };
}

describe('Rate Limit Middleware (WR-003, ADR-008)', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await RateLimitModel.deleteMany({ userId: { $in: userIds } });
    await disconnectDB();
  });

  it('fails closed with 429 when the database errors and does not call next', async () => {
    const userId = `rl-failclosed-${uuidv4()}`;
    userIds.push(userId);
    vi.spyOn(RateLimitModel, 'findOneAndUpdate').mockRejectedValueOnce(new Error('db down'));

    const limiter = createRateLimiter(10, 5);
    const next = vi.fn();
    const { res, getStatus, getData } = makeRes();

    await limiter({ user: { uid: userId } } as any, res, next);

    expect(getStatus()).toBe(429);
    expect(getData().success).toBe(false);
    expect(getData().error).toBe('Too Many Requests');
    expect(getData().message).toContain('unavailable');
    expect(next).not.toHaveBeenCalled();
  });

  it('converges sequential upserts onto a single window doc (floored window + unique index)', async () => {
    const userId = `rl-window-${uuidv4()}`;
    userIds.push(userId);
    const limiter = createRateLimiter(10, 5);

    const first = makeRes();
    const second = makeRes();
    const next1 = vi.fn();
    const next2 = vi.fn();

    await limiter({ user: { uid: userId } } as any, first.res, next1);
    await limiter({ user: { uid: userId } } as any, second.res, next2);

    expect(first.getStatus()).toBe(200);
    expect(second.getStatus()).toBe(200);
    expect(next1).toHaveBeenCalledTimes(1);
    expect(next2).toHaveBeenCalledTimes(1);

    const docs = await RateLimitModel.find({ userId }).lean();
    expect(docs.length).toBe(1);
    expect(docs[0].count).toBe(2);
  });

  it('rejects requests beyond the configured max', async () => {
    const userId = `rl-exceed-${uuidv4()}`;
    userIds.push(userId);
    const limiter = createRateLimiter(2, 5);

    const results = [makeRes(), makeRes(), makeRes()];
    const nexts = [vi.fn(), vi.fn(), vi.fn()];

    for (let i = 0; i < 3; i++) {
      await limiter({ user: { uid: userId } } as any, results[i].res, nexts[i]);
    }

    expect(results[0].getStatus()).toBe(200);
    expect(results[1].getStatus()).toBe(200);
    expect(results[2].getStatus()).toBe(429);
    expect(results[2].getData().success).toBe(false);
    expect(results[2].getData().error).toBe('Too Many Requests');
    expect(nexts[0]).toHaveBeenCalledTimes(1);
    expect(nexts[1]).toHaveBeenCalledTimes(1);
    expect(nexts[2]).not.toHaveBeenCalled();
  });
});