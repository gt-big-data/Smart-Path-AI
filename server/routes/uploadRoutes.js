"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uploadController_1 = require("../controllers/uploadController");
const router = (0, express_1.Router)();
router.post('/process-pdf', uploadController_1.upload.single('file'), uploadController_1.processPdf);
router.post('/cancel-processing', uploadController_1.cancelProcessing);
exports.default = router;
