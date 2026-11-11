import { Router } from 'express';
import multer from 'multer';
import { generate, list, get, createAttempt, listAttempts, getAttempt, saveDraft, submit,
  uploadSample, listSamples, getSampleFile,
  route, requirePracticeExamUser, practiceExamError } from '../controllers/practiceExamController';
const router = Router();
// Busboy emits LIMIT_FILE_SIZE when it reaches the limit, including exact-size
// files. Allow one extra byte here; storeSample enforces the inclusive 10 MB cap.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 + 1, files: 1, fields: 2 } });
router.use(requirePracticeExamUser);
router.post('/samples', upload.single('practice_exam'), route(uploadSample));
router.get('/samples', route(listSamples));
router.get('/samples/:sampleId/file', route(getSampleFile));
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
