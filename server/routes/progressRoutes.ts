import express, { Router, RequestHandler } from 'express';
import { updateConceptProgress, getConceptProgress } from '../controllers/progressController';
import { listAssessments } from '../controllers/assessmentController';

const router: Router = express.Router();
router.get('/progress/assessments', listAssessments as RequestHandler);

router.post('/update', updateConceptProgress as RequestHandler);
router.get('/', getConceptProgress as RequestHandler);
router.get('/concept-progress', getConceptProgress as RequestHandler);
router.post('/concept-progress', updateConceptProgress as RequestHandler);

export default router;
