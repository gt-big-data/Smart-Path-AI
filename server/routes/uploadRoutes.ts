import { Router } from 'express';
import { upload, processPdf, cancelProcessing } from '../controllers/uploadController';

const router = Router();

router.post('/process-pdf', upload.single('file'), processPdf);
router.post('/cancel-processing', cancelProcessing);

export default router; 