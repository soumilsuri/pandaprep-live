import { Request, Response, NextFunction } from 'express';
import { RateLimitModel } from '../models/rate-limit.model.js';
import { logger } from '../config/logger.js';

async function upsertAndIncrement(userId: string, windowStart: Date) {
  const filter = { userId, windowStart: { $gte: windowStart } };
  const update = { $inc: { count: 1 }, $setOnInsert: { windowStart } };

  try {
    return await RateLimitModel.findOneAndUpdate(filter, update, { upsert: true, new: true });
  } catch (error: any) {
    if (error?.code === 11000) {
      return await RateLimitModel.findOneAndUpdate(filter, update, { upsert: true, new: true });
    }
    throw error;
  }
}

export function createRateLimiter(maxRequests = 10, windowMinutes = 5) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.uid || req.ip || 'anonymous';
    const windowStart = new Date(
      Math.floor(Date.now() / (windowMinutes * 60 * 1000)) * windowMinutes * 60 * 1000
    );

    try {
      const doc = await upsertAndIncrement(userId, windowStart);

      if (doc.count > maxRequests) {
        logger.warn({ userId, count: doc.count, maxRequests }, 'Rate limit exceeded');
        return res.status(429).json({
          success: false,
          error: 'Too Many Requests',
          message: `Rate limit of ${maxRequests} requests per ${windowMinutes} minutes exceeded. Please retry later.`,
        });
      }

      next();
    } catch (error) {
      logger.error({ err: error, userId }, 'Rate limit check error, failing closed');
      return res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message: 'Rate limiter unavailable; please retry shortly.',
      });
    }
  };
}
