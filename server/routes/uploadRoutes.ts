import { Router } from 'express';
import { upload, processPdf } from '../controllers/uploadController';

const router = Router();

router.post('/process-pdf', upload.single('file'), processPdf);

export default router; 