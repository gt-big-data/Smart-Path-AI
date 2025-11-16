import { Router, RequestHandler } from 'express';
import { viewGraph, generateQuestionsWithAnswers, verifyAnswer, generateConversationResponse, getUserProfile, getNodeMetadata } from '../controllers/graphController';

const router = Router();

router.get('/view-graph', viewGraph as RequestHandler);
router.get('/node-metadata', getNodeMetadata as RequestHandler);
router.get('/generate-questions-with-answers', generateQuestionsWithAnswers as RequestHandler);
router.post('/verify-answer', verifyAnswer as RequestHandler);
router.post('/generate-conversation-response', generateConversationResponse as RequestHandler);
router.get('/user/profile', getUserProfile as RequestHandler);

export default router;