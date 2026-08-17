import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';

const router = Router();

const statusMap: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

const healthHandler = (req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState;

  if (dbState !== 1) {
    res.status(503).json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      database: statusMap[dbState] || 'unknown',
      uptimeSeconds: process.uptime(),
    });
    return;
  }

  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: statusMap[dbState] || 'unknown',
    uptimeSeconds: process.uptime(),
  });
};

router.get('/health', healthHandler);
router.get('/api/health', healthHandler);

export default router;