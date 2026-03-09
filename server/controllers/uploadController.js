"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelProcessing = exports.processPdf = exports.upload = void 0;
const axios_1 = __importDefault(require("axios"));
const multer_1 = __importDefault(require("multer"));
const form_data_1 = __importDefault(require("form-data"));
const crypto_1 = require("crypto");
// Configure multer for handling file uploads
exports.upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    fileFilter: (req, file, cb) => {
        console.log('Received file:', file.originalname, 'Type:', file.mimetype);
        // Allow only PDF files
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        }
        else {
            cb(null, false);
            return cb(new Error('Only PDF files are allowed!'));
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});
// Track active upload AbortControllers so they can be cancelled externally
// Key: a unique upload session id
const activeUploads = new Map();
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8000';
const getRequestOwnerKey = (req) => {
    var _a, _b;
    const passportUser = (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.passport) === null || _b === void 0 ? void 0 : _b.user;
    if (passportUser) {
        const userId = typeof passportUser === 'object' && passportUser._id
            ? passportUser._id
            : passportUser;
        return `user:${String(userId)}`;
    }
    return `session:${req.sessionID}`;
};
const notifyPythonCancelIfNoActiveUploads = () => __awaiter(void 0, void 0, void 0, function* () {
    if (activeUploads.size !== 0) {
        return;
    }
    try {
        yield axios_1.default.post(`${PYTHON_SERVICE_URL}/cancel-processing`, {}, { timeout: 3000 });
        console.log('[Cancel] AI server cancel endpoint called successfully');
    }
    catch (_a) {
        // AI server may not have a cancel endpoint — that's fine
        console.log('[Cancel] AI server cancel endpoint not available (this is OK)');
    }
});
// Helper to get a human-readable progress message
function getProgressMessage(percent) {
    if (percent < 10)
        return 'Uploading PDF...';
    if (percent < 20)
        return 'PDF received, starting analysis...';
    if (percent < 35)
        return 'Extracting text from pages...';
    if (percent < 50)
        return 'Identifying key concepts...';
    if (percent < 65)
        return 'Building knowledge connections...';
    if (percent < 80)
        return 'Constructing knowledge graph...';
    if (percent < 95)
        return 'Finalizing your learning path...';
    return 'Processing complete!';
}
const processPdf = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g;
    const ownerKey = getRequestOwnerKey(req);
    // Set up SSE headers for streaming progress
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering if present
    res.flushHeaders();
    // Create an AbortController to cancel the request to the AI server
    const abortController = new AbortController();
    const uploadId = (0, crypto_1.randomUUID)();
    activeUploads.set(uploadId, { controller: abortController, ownerKey });
    let progressInterval = null;
    let clientDisconnected = false;
    let responseCompleted = false;
    const clearProgressInterval = () => {
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
    };
    const sendEvent = (data) => {
        if (!clientDisconnected) {
            try {
                res.write(`data: ${JSON.stringify(data)}\n\n`);
            }
            catch (_a) {
                // Client already disconnected, ignore write errors
            }
        }
    };
    // Listen for client disconnect (e.g. when the browser aborts the fetch)
    res.on('close', () => {
        // `close` also fires after normal completion; only treat as disconnect
        // while the streaming response is still in progress.
        if (responseCompleted) {
            return;
        }
        if (!clientDisconnected) {
            clientDisconnected = true;
            console.log(`[Upload ${uploadId}] Client disconnected — aborting AI server request`);
            // Abort the in-flight request to the Python AI server
            abortController.abort();
            // Clear progress interval
            clearProgressInterval();
            // Clean up active upload tracking
            activeUploads.delete(uploadId);
            // Also try to tell the AI server to cancel (fire-and-forget)
            void notifyPythonCancelIfNoActiveUploads();
        }
    });
    try {
        console.log(`[Upload ${uploadId}] Processing PDF request received`);
        if (!req.file) {
            console.log('No file found in request');
            sendEvent({ type: 'error', error: 'No file uploaded' });
            res.end();
            return;
        }
        console.log('File received:', {
            filename: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        });
        sendEvent({ type: 'progress', percent: 5, message: 'Uploading PDF...' });
        // Create FormData instance for Node.js
        const formData = new form_data_1.default();
        // Append the buffer directly with the original filename
        formData.append('file', req.file.buffer, {
            filename: req.file.originalname,
            contentType: 'application/pdf'
        });
        sendEvent({ type: 'progress', percent: 15, message: 'PDF received, starting analysis...' });
        console.log('Sending request to processing server...');
        // Simulate incremental progress while waiting for the Python server
        let currentProgress = 15;
        progressInterval = setInterval(() => {
            if (currentProgress < 90) {
                // Gradually slow down as we approach 90%
                const increment = Math.max(1, (90 - currentProgress) * 0.08);
                currentProgress = Math.min(90, currentProgress + increment);
                const rounded = Math.round(currentProgress);
                sendEvent({ type: 'progress', percent: rounded, message: getProgressMessage(rounded) });
            }
        }, 1500);
        // Send to processing server, passing the abort signal so we can cancel mid-flight
        const response = yield axios_1.default.post(`${PYTHON_SERVICE_URL}/process-pdf`, formData, {
            headers: Object.assign({}, formData.getHeaders()),
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            signal: abortController.signal,
        });
        clearProgressInterval();
        // If client already disconnected while we were waiting, don't bother sending events
        if (clientDisconnected) {
            console.log(`[Upload ${uploadId}] AI server responded but client already disconnected — discarding result`);
            return;
        }
        console.log(`[Upload ${uploadId}] Received response from processing server`);
        sendEvent({ type: 'progress', percent: 95, message: 'Finalizing your learning path...' });
        sendEvent({ type: 'progress', percent: 100, message: 'Processing complete!' });
        sendEvent({ type: 'complete', data: response.data });
        responseCompleted = true;
        res.end();
    }
    catch (error) {
        clearProgressInterval();
        // If the request was cancelled (client disconnect or explicit cancel), don't send error events
        if (axios_1.default.isCancel(error) || abortController.signal.aborted) {
            console.log(`[Upload ${uploadId}] Request was cancelled`);
            if (!clientDisconnected) {
                sendEvent({ type: 'error', error: 'Processing was cancelled' });
                responseCompleted = true;
                res.end();
            }
            return;
        }
        // AI server intentionally returns 499 when cancellation is acknowledged.
        if (axios_1.default.isAxiosError(error) && ((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) === 499) {
            console.log(`[Upload ${uploadId}] AI server returned cancellation (499)`);
            if (!clientDisconnected) {
                sendEvent({ type: 'error', error: 'Processing was cancelled' });
                responseCompleted = true;
                res.end();
            }
            return;
        }
        console.error('Detailed error information:');
        if (axios_1.default.isAxiosError(error)) {
            console.error('Axios Error:', {
                message: error.message,
                response: (_b = error.response) === null || _b === void 0 ? void 0 : _b.data,
                status: (_c = error.response) === null || _c === void 0 ? void 0 : _c.status,
                headers: (_d = error.response) === null || _d === void 0 ? void 0 : _d.headers
            });
            sendEvent({
                type: 'error',
                error: ((_f = (_e = error.response) === null || _e === void 0 ? void 0 : _e.data) === null || _f === void 0 ? void 0 : _f.error) || 'Failed to process PDF',
                details: `${error.message} - Status: ${(_g = error.response) === null || _g === void 0 ? void 0 : _g.status}`
            });
        }
        else {
            console.error('Non-Axios Error:', error);
            sendEvent({
                type: 'error',
                error: 'Failed to process PDF',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
        if (!clientDisconnected) {
            responseCompleted = true;
            res.end();
        }
    }
    finally {
        clearProgressInterval();
        activeUploads.delete(uploadId);
    }
});
exports.processPdf = processPdf;
// Cancel endpoint: explicitly aborts all active upload processing
const cancelProcessing = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const userId = (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.passport) === null || _b === void 0 ? void 0 : _b.user;
    if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
    }
    const ownerKey = getRequestOwnerKey(req);
    console.log(`[Cancel] Cancelling uploads for ${ownerKey}`);
    let cancelled = 0;
    for (const [id, activeUpload] of activeUploads) {
        if (activeUpload.ownerKey !== ownerKey) {
            continue;
        }
        console.log(`[Cancel] Aborting upload ${id}`);
        activeUpload.controller.abort();
        activeUploads.delete(id);
        cancelled += 1;
    }
    yield notifyPythonCancelIfNoActiveUploads();
    res.json({ success: true, message: 'Processing cancelled', cancelled });
});
exports.cancelProcessing = cancelProcessing;
