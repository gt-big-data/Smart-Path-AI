import express, { Router, RequestHandler } from 'express';
import { updateConceptProgress, getConceptProgress } from '../controllers/progressController';

const router: Router = express.Router();

router.post('/update', updateConceptProgress as RequestHandler);
router.get('/', getConceptProgress as RequestHandler);

export default router;
