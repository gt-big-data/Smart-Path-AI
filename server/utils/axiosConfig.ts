import axios from 'axios';

// Configure axios instance for Python service with proper timeouts
// Using 127.0.0.1 instead of localhost to avoid IPv6 issues
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8000';

export const pythonServiceClient = axios.create({
  baseURL: PYTHON_SERVICE_URL,
  timeout: 30000, // 30 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for logging
pythonServiceClient.interceptors.request.use(
  (config) => {
    console.log(`[Python Service] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('[Python Service] Request error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
pythonServiceClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      console.error(`[Python Service] Connection failed to ${PYTHON_SERVICE_URL}`);
      console.error('Make sure the Python service is running and accessible');
    }
    return Promise.reject(error);
  }
);

export default pythonServiceClient;

