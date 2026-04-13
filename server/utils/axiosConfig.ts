import axios from 'axios';

// Configure axios instance for Python service with proper timeouts.
// Must match server runtime: use PYTHON_SERVICE_URL (e.g. Cloud Run AI URL or local dev).
const PYTHON_SERVICE_URL =
  process.env.PYTHON_SERVICE_URL || 'https://smartpath-backend-361386464842.us-east1.run.app';

export const pythonServiceClient = axios.create({
  baseURL: PYTHON_SERVICE_URL,
  timeout: 120000, // 120 seconds (2 minutes) timeout for AI operations
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for logging
pythonServiceClient.interceptors.request.use(
  (config) => {
    // Node multipart uploads: merge FormData headers so default Content-Type: application/json does not win.
    const d = config.data as { getHeaders?: () => Record<string, string> } | undefined;
    if (d && typeof d.getHeaders === 'function') {
      const h = config.headers || {};
      delete (h as Record<string, unknown>)['Content-Type'];
      delete (h as Record<string, unknown>)['content-type'];
      Object.assign(h, d.getHeaders());
    }
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

