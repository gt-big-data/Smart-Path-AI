import { Router } from 'express';
import { viewGraph, generateQuestionsWithAnswers, verifyAnswer } from '../controllers/graphController';

const router = Router();

router.get('/view-graph', viewGraph);
router.get('/generate-questions-with-answers', generateQuestionsWithAnswers);
router.post('/verify-answer', verifyAnswer);

export default router; 