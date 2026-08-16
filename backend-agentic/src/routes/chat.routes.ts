import { Router } from 'express';
import {
  chatWithNotesHandler,
  getChatHistoryHandler,
} from '../controllers/chat.controller.js';
import { verifyFirebaseToken } from '../middleware/auth.middleware.js';
import { createRateLimiter } from '../middleware/rate-limit.middleware.js';

const router = Router();

const chatLimiter = createRateLimiter(30, 5);

router.post('/chat-with-notes', verifyFirebaseToken, chatLimiter, chatWithNotesHandler);
router.post('/message', verifyFirebaseToken, chatLimiter, chatWithNotesHandler);
router.get('/history/:missionId', verifyFirebaseToken, getChatHistoryHandler);

export default router;
