import express, { Router, RequestHandler } from 'express';
import { 
  saveQuizHistory, 
  getUserQuizHistories, 
  getAllQuizHistories, 
  getQuizHistoryById 
} from '../controllers/quizHistoryController';

const router: Router = express.Router();

// Save a new quiz history when a quiz is completed
router.post('/', saveQuizHistory as RequestHandler);

// Get all quiz histories for the authenticated user
router.get('/', getUserQuizHistories as RequestHandler);

// Get a specific quiz history by ID (user must own it)
router.get('/:id', getQuizHistoryById as RequestHandler);

// Admin/debug endpoint to get all quiz histories across users
router.get('/admin/all', getAllQuizHistories as RequestHandler);

export default router;
