"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pythonServiceClient = void 0;
const axios_1 = __importDefault(require("axios"));
// Configure axios instance for Python service with proper timeouts
// Using 127.0.0.1 instead of localhost to avoid IPv6 issues
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'https://smartpath-backend-361386464842.us-east1.run.app';
exports.pythonServiceClient = axios_1.default.create({
    baseURL: PYTHON_SERVICE_URL,
    timeout: 120000, // 120 seconds (2 minutes) timeout for AI operations
    headers: {
        'Content-Type': 'application/json',
    },
});
// Add request interceptor for logging
exports.pythonServiceClient.interceptors.request.use((config) => {
    var _a;
    const d = config.data;
    if (d && typeof d.getHeaders === 'function') {
        const h = config.headers || {};
        delete h['Content-Type'];
        delete h['content-type'];
        Object.assign(h, d.getHeaders());
    }
    console.log(`[Python Service] ${(_a = config.method) === null || _a === void 0 ? void 0 : _a.toUpperCase()} ${config.url}`);
    return config;
}, (error) => {
    console.error('[Python Service] Request error:', error);
    return Promise.reject(error);
});
// Add response interceptor for error handling
exports.pythonServiceClient.interceptors.response.use((response) => {
    return response;
}, (error) => {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        console.error(`[Python Service] Connection failed to ${PYTHON_SERVICE_URL}`);
        console.error('Make sure the Python service is running and accessible');
    }
    return Promise.reject(error);
});
exports.default = exports.pythonServiceClient;
