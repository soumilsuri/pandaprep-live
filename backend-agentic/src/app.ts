import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { correlationIdMiddleware } from './middleware/correlation-id.middleware.js';
import pipelineRoutes from './routes/pipeline.routes.js';
import chatRoutes from './routes/chat.routes.js';
import healthRoutes from './routes/health.routes.js';
import { logger } from './config/logger.js';

const app = express();
app.disable('x-powered-by');

const allowedOrigins = env.CORS_ORIGIN
  ? env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173', 'https://pandaprep.tech', 'https://pandaprepai.tech'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin) return callback(null, true);
      if (env.NODE_ENV === 'development' || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy blocked access from origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '500kb' }));
app.use(express.urlencoded({ extended: true, limit: '500kb' }));
app.use(correlationIdMiddleware);

/**
 * Wraps an async route/middleware handler so rejected promises are forwarded
 * to the centralized error middleware (Express 4 does not catch async rejections).
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Middleware to ensure database connection
app.use(
  asyncHandler(async (req, res, next) => {
    try {
      await connectDB();
      next();
    } catch (error: unknown) {
      logger.error({ err: error }, 'Database connection error in middleware');
      res.status(503).json({
        success: false,
        error: 'Database unavailable',
      });
    }
  })
);

// Mount Agentic Backend Routes
app.use('/api/pipeline', pipelineRoutes);
app.use('/api/chat', chatRoutes);
app.use('/', healthRoutes);

// 404 handler for unknown paths
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not Found' });
});

/**
 * Centralized error middleware: logs the error and returns a generic
 * response, never leaking internal error messages to clients.
 */
export function errorMiddleware(err: Error, req: Request, res: Response, next: NextFunction) {
  logger.error({ err, requestId: req.correlationId }, 'Unhandled error in request pipeline');
  const maybeErr = err as { status?: unknown };
  const status = typeof maybeErr.status === 'number' ? maybeErr.status : 500;
  res.status(status).json({ success: false, error: 'Internal Server Error' });
}

app.use(errorMiddleware);

export { app };
export default app;