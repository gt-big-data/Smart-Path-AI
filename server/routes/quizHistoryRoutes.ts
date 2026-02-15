import express, { Router, RequestHandler } from 'express';
import { 
  saveQuizHistory, 
  getUserQuizHistories, 
  getAllQuizHistories, 
  getQuizHistoryById,
  processAllQuizHistory
} from '../controllers/quizHistoryController';

const router: Router = express.Router();

// Save a new quiz history when a quiz is completed
router.post('/', saveQuizHistory as RequestHandler);

// Process all existing quiz history to create progress records (MUST come before /:id)
router.post('/process-all', processAllQuizHistory as RequestHandler);

// Get all quiz histories for the authenticated user
router.get('/', getUserQuizHistories as RequestHandler);

// Admin/debug endpoint to get all quiz histories across users
router.get('/admin/all', getAllQuizHistories as RequestHandler);

// Get a specific quiz history by ID (user must own it) - MUST be last
router.get('/:id', getQuizHistoryById as RequestHandler);

export default router;
