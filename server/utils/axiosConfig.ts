import axios from 'axios';

// Configure axios instance for Python service with proper timeouts
// Using 127.0.0.1 instead of localhost to avoid IPv6 issues
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'https://smartpath-backend-361386464842.us-east1.run.app';

export const pythonServiceClient = axios.create({
  baseURL: PYTHON_SERVICE_URL,
  timeout: 120000, // 120 seconds (2 minutes) timeout for AI operations
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for logging and Cloud Run auth
pythonServiceClient.interceptors.request.use(
  async (config) => {
    console.log(`[Python Service] ${config.method?.toUpperCase()} ${config.url}`);
    if (process.env.VERCEL === '1' && process.env.GCP_CLOUD_RUN_URL && config.baseURL === process.env.GCP_CLOUD_RUN_URL) {
      const { getGcpAccessToken } = await import('./gcpAuth');
      const token = await getGcpAccessToken();
      config.headers.set('Authorization', `Bearer ${token}`);
    }
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

