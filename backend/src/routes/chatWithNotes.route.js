import express from 'express';
import {
  chatWithPdfController,
  streamChatWithPdfController,
  processPdfController,
  reloadPdfAndChatController
} from '../controllers/chatWithNotes.controller.js';
import { verifyFirebaseToken } from '../middlewares/auth-verify.middleware.js';

const router = express.Router();

// Route to upload and process a PDF file
router.post('/process-pdf', verifyFirebaseToken, processPdfController);

// Route to chat with a processed PDF document
router.post('/chat-with-pdf', verifyFirebaseToken, chatWithPdfController);

// Route for streaming chat responses
router.post('/stream-chat-with-pdf', verifyFirebaseToken, streamChatWithPdfController);

// Reload PDF and get chat history
router.post('/reload-pdf', verifyFirebaseToken, reloadPdfAndChatController);

export default router;