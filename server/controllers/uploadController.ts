import { Request, Response, RequestHandler } from 'express';
import axios from 'axios';
import multer from 'multer';
import FormData from 'form-data';
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

export const processPdf: RequestHandler = async (req, res) => {
  // Set up SSE headers for streaming progress
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering if present
  res.flushHeaders();

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    console.log('Processing PDF request received');
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
    const progressInterval = setInterval(() => {
      if (currentProgress < 90) {
        // Gradually slow down as we approach 90%
        const increment = Math.max(1, (90 - currentProgress) * 0.08);
        currentProgress = Math.min(90, currentProgress + increment);
        const rounded = Math.round(currentProgress);
        sendEvent({ type: 'progress', percent: rounded, message: getProgressMessage(rounded) });
      }
    }, 1500);

    // Send to processing server
    const response = await pythonServiceClient.post('/process-pdf', formData, {
      params: req.query,
      headers: {
        ...formData.getHeaders()
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    clearInterval(progressInterval);

    console.log('Received response from processing server');

    sendEvent({ type: 'progress', percent: 95, message: 'Finalizing your learning path...' });
    sendEvent({ type: 'progress', percent: 100, message: 'Processing complete!' });
    sendEvent({ type: 'complete', data: response.data });
    res.end();
  } catch (error) {
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
        error: error.response?.data?.error || 'Failed to process PDF',
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
    res.end();
  }
}; 
