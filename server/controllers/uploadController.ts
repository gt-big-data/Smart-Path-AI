import { Request, Response, RequestHandler } from 'express';
import axios from 'axios';
import multer from 'multer';
import FormData from 'form-data';
import { randomUUID } from 'crypto';
import { pythonServiceClient } from '../utils/axiosConfig';

// Configure multer for handling file uploads
export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    console.log('Received file:', file.originalname, 'Type:', file.mimetype);
    // Allow only PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(null, false);
      return cb(new Error('Only PDF files are allowed!'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

type ActiveUpload = {
  controller: AbortController;
  ownerKey: string;
};

// Track active upload AbortControllers so they can be cancelled externally
// Key: a unique upload session id
const activeUploads = new Map<string, ActiveUpload>();

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'https://smartpath-backend-361386464842.us-east1.run.app';

const getRequestOwnerKey = (req: Request): string => {
  const passportUser = (req.session as any)?.passport?.user;
  if (passportUser) {
    const userId = typeof passportUser === 'object' && passportUser._id
      ? passportUser._id
      : passportUser;
    return `user:${String(userId)}`;
  }
  return `session:${req.sessionID}`;
};

const notifyPythonCancelIfNoActiveUploads = async () => {
  if (activeUploads.size !== 0) {
    return;
  }

  try {
    await axios.post(`${PYTHON_SERVICE_URL}/cancel-processing`, {}, { timeout: 3000 });
    console.log('[Cancel] AI server cancel endpoint called successfully');
  } catch {
    // AI server may not have a cancel endpoint — that's fine
    console.log('[Cancel] AI server cancel endpoint not available (this is OK)');
  }
};

// Helper to get a human-readable progress message
function getProgressMessage(percent: number): string {
  if (percent < 10) return 'Uploading PDF...';
  if (percent < 20) return 'PDF received, starting analysis...';
  if (percent < 35) return 'Extracting text from pages...';
  if (percent < 50) return 'Identifying key concepts...';
  if (percent < 65) return 'Building knowledge connections...';
  if (percent < 80) return 'Constructing knowledge graph...';
  if (percent < 95) return 'Finalizing your learning path...';
  return 'Processing complete!';
}

const isMetadataOnlyGraph = (payload: any): boolean => {
  const nodes = payload?.graph?.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return true;
  }

  if (nodes.length !== 1) {
    return false;
  }

  const node = nodes[0] || {};
  const labels = Array.isArray(node.labels) ? node.labels : [];
  const subject = String(node?.properties?.subject || '').toLowerCase();
  return labels.includes('GraphMetadata') && subject === 'default';
};

/** FastAPI typically returns `{ detail: string }` on errors; other stacks use `{ error: string }`. */
const getAiServiceErrorMessage = (data: unknown): string | undefined => {
  if (!data || typeof data !== 'object') return undefined;
  const d = data as Record<string, unknown>;
  if (typeof d.error === 'string' && d.error.length > 0) return d.error;
  if (typeof d.detail === 'string' && d.detail.length > 0) return d.detail;
  if (Array.isArray(d.detail) && d.detail.length > 0) return JSON.stringify(d.detail);
  if (typeof d.message === 'string' && d.message.length > 0) return d.message;
  return undefined;
};

export const processPdf: RequestHandler = async (req, res) => {
  const ownerKey = getRequestOwnerKey(req);

  // Set up SSE headers for streaming progress
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering if present
  res.flushHeaders();

  // Create an AbortController to cancel the request to the AI server
  const abortController = new AbortController();
  const uploadId = randomUUID();
  activeUploads.set(uploadId, { controller: abortController, ownerKey });

  let progressInterval: ReturnType<typeof setInterval> | null = null;
  let clientDisconnected = false;
  let responseCompleted = false;
  const clearProgressInterval = () => {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
  };

  const sendEvent = (data: object) => {
    if (!clientDisconnected) {
      try {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch {
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
    const formData = new FormData();
    
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

    // Send to processing server (long PDFs + LLM can exceed the default 120s axios timeout)
    const response = await pythonServiceClient.post('/process-pdf', formData, {
      params: req.query,
      headers: {
        ...formData.getHeaders()
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      signal: abortController.signal,
      timeout: 900000,
    });

    clearProgressInterval();

    if (isMetadataOnlyGraph(response.data)) {
      console.warn(`[Upload ${uploadId}] AI service returned metadata-only or empty graph`, {
        graph_id: (response.data as any)?.graph_id,
      });
    }

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
  } catch (error) {
    clearProgressInterval();

    // If the request was cancelled (client disconnect or explicit cancel), don't send error events
    if (axios.isCancel(error) || abortController.signal.aborted) {
      console.log(`[Upload ${uploadId}] Request was cancelled`);
      if (!clientDisconnected) {
        sendEvent({ type: 'error', error: 'Processing was cancelled' });
        responseCompleted = true;
        res.end();
      }
      return;
    }

    // AI server intentionally returns 499 when cancellation is acknowledged.
    if (axios.isAxiosError(error) && error.response?.status === 499) {
      console.log(`[Upload ${uploadId}] AI server returned cancellation (499)`);
      if (!clientDisconnected) {
        sendEvent({ type: 'error', error: 'Processing was cancelled' });
        responseCompleted = true;
        res.end();
      }
      return;
    }

    console.error('Detailed error information:');
    if (axios.isAxiosError(error)) {
      console.error('Axios Error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers
      });
      sendEvent({
        type: 'error',
        error: getAiServiceErrorMessage(error.response?.data) || 'Failed to process PDF',
        details: `${error.message} - Status: ${error.response?.status}`
      });
    } else {
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
  } finally {
    clearProgressInterval();
    activeUploads.delete(uploadId);
  }
};

// Cancel endpoint: explicitly aborts all active upload processing
export const cancelProcessing: RequestHandler = async (req, res) => {
  const userId = (req.session as any)?.passport?.user;
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

  await notifyPythonCancelIfNoActiveUploads();

  res.json({ success: true, message: 'Processing cancelled', cancelled });
};
