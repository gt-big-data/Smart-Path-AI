import { Request, Response, RequestHandler } from 'express';
import axios from 'axios';
import multer from 'multer';
import FormData from 'form-data';

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

export const processPdf: RequestHandler = async (req, res) => {
  try {
    console.log('Processing PDF request received');
    if (!req.file) {
      console.log('No file found in request');
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    console.log('File received:', {
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Create FormData instance for Node.js
    const formData = new FormData();
    
    // Append the buffer directly with the original filename
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: 'application/pdf'
    });

    console.log('Sending request to processing server...');
    // Send to processing server
    const response = await axios.post('http://localhost:8000/process-pdf', formData, {
      headers: {
        ...formData.getHeaders()
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    console.log('Received response from processing server');
    // Send the processing result
    res.json(response.data);
  } catch (error) {
    console.error('Detailed error information:');
    if (axios.isAxiosError(error)) {
      console.error('Axios Error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers
      });
      res.status(500).json({ 
        error: error.response?.data?.error || 'Failed to process PDF',
        details: `${error.message} - Status: ${error.response?.status}`
      });
    } else {
      console.error('Non-Axios Error:', error);
      res.status(500).json({ 
        error: 'Failed to process PDF',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}; 