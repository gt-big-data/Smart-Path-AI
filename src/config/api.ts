// Callers append paths like `/api/...`, so a trailing slash here would produce `//api/...`, which Express 404s.
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV
    ? 'http://localhost:4000'
    : 'https://smartpath-node-backend-361386464842.us-east1.run.app')
).replace(/\/+$/, '');