import { Router } from 'express';
import {
  generateNotesHandler,
  getGenerationStatusHandler,
} from '../controllers/pipeline.controller.js';
import { getPipelineMetricsHandler } from '../controllers/metrics.controller.js';
import { verifyFirebaseToken } from '../middleware/auth.middleware.js';
import { createRateLimiter } from '../middleware/rate-limit.middleware.js';

const router = Router();

router.post(
  '/generate-notes',
  verifyFirebaseToken,
  createRateLimiter(10, 5),
  generateNotesHandler
);

router.get(
  '/generation-status/:requestId',
  verifyFirebaseToken,
  getGenerationStatusHandler
);

router.get(
  '/metrics',
  verifyFirebaseToken,
  createRateLimiter(60, 1),
  getPipelineMetricsHandler
);

export default router;
