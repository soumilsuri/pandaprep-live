import express from 'express';
import { 
    getUserNotesHistoryController, 
    getSingleNoteHistoryController,
    getUserNotesStatsController,
    deleteUserNoteController,
    updateNoteDisplayNameController
  } from '../controllers/user-history.controller.js';
import { verifyFirebaseToken } from '../middlewares/auth-verify.middleware.js';
  
const router = express.Router();

// Get all notes for a user
router.post('/notes', verifyFirebaseToken , getUserNotesHistoryController);
  
// // Get details for a specific note
// router.post('/notes/:requestId', getSingleNoteHistoryController);
  
// Get note statistics for a user
router.get('/:email/notes-stats', verifyFirebaseToken, getUserNotesStatsController);
  
// Delete a note
router.post('/notes/delete', verifyFirebaseToken, deleteUserNoteController);

// Rename notes
router.post('/notes/rename', verifyFirebaseToken, updateNoteDisplayNameController);

export default router;