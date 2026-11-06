import { Router } from 'express';
import multer from 'multer';
import { generate, list, get, createAttempt, listAttempts, getAttempt, saveDraft, submit,
  route, requirePracticeExamUser, practiceExamError } from '../controllers/practiceExamController';
const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 2 } });
router.use(requirePracticeExamUser);
router.post('/', upload.single('practice_exam'), route(generate));
router.get('/', route(list));
router.get('/:examId', route(get));
router.post('/:examId/attempts', route(createAttempt));
router.get('/:examId/attempts', route(listAttempts));
router.get('/:examId/attempts/:attemptId', route(getAttempt));
router.patch('/:examId/attempts/:attemptId', route(saveDraft));
router.post('/:examId/attempts/:attemptId/submit', route(submit));
router.use(practiceExamError);
export default router;
