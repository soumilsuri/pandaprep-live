import { Request, Response, NextFunction } from 'express';
import { admin } from '../config/firebase.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export interface AuthenticatedUser {
  uid: string;
  email?: string | null;
  [key: string]: unknown;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const verifyFirebaseToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: No authorization token provided',
    });
  }

  try {
    if (!admin.apps.length) {
      if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
        req.user = { uid: 'dev-user', email: 'dev@pandaprep.test' };
        return next();
      }
      logger.error('Firebase Admin not initialized in production environment');
      return res.status(503).json({
        success: false,
        error: 'Authentication service unavailable',
      });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken as AuthenticatedUser;
    next();
  } catch (error) {
    logger.warn({ err: error }, 'Failed to verify Firebase token');
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or expired authorization token',
    });
  }
};