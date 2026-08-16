import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import app, { errorMiddleware } from '../../src/app.js';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { Server } from 'http';

describe('App error handling (WR-008)', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    await connectDB();
    server = app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await disconnectDB();
  });

  it('returns 200 healthy JSON on /api/health when the database is connected', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(body.database).toBe('connected');
  });

  it('returns a JSON 404 body for unknown paths', async () => {
    const res = await fetch(`${baseUrl}/api/nope`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: 'Not Found' });
  });

  it('returns 503 degraded JSON on /api/health when the database is disconnected', async () => {
    vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(0);

    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe('degraded');
    expect(body.database).toBe('disconnected');
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('error middleware responds with a generic 500 and never leaks the error message', () => {
    let statusCode = 0;
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

    errorMiddleware(new Error('secret internal database detail'), {} as any, res, vi.fn());

    expect(statusCode).toBe(500);
    expect(body).toEqual({ success: false, error: 'Internal Server Error' });
    expect(JSON.stringify(body)).not.toContain('secret');
  });
});