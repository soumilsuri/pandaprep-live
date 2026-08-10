import express from 'express';
import {
  generateNotesController,
  getGenerationStatus,
} from '../controllers/pipeline.controller.js';
import { verifyFirebaseToken } from '../middlewares/auth-verify.middleware.js';

const router = express.Router();

// Initiate notes generation — returns requestId, client polls for status
router.post('/generate-notes', verifyFirebaseToken, generateNotesController);

// Poll this endpoint to check generation status and get download URL when complete
router.get('/generation-status/:requestId', verifyFirebaseToken, getGenerationStatus);

export default router;
