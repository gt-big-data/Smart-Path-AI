import { Router, RequestHandler } from 'express';
import { viewGraph, generateQuestionsWithAnswers, verifyAnswer } from '../controllers/graphController';

const router = Router();

router.get('/view-graph', viewGraph as RequestHandler);
router.get('/generate-questions-with-answers', generateQuestionsWithAnswers as RequestHandler);
router.post('/verify-answer', verifyAnswer as RequestHandler);

export default router; 