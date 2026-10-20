import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  test: {
    globals: true,
    environment: 'node',
  },
  server: {
    proxy: {
      '^/chat/': 'http://127.0.0.1:4000',
      '/chat': {
        target: 'http://127.0.0.1:4000',
        // Keep the React Router page on Vite while forwarding API requests.
        bypass(req) {
          if (req.method === 'GET' && (req.url === '/chat' || req.url === '/chat/')) {
            return '/index.html';
          }
        },
      },
      '/upload': 'http://127.0.0.1:4000',
      '/auth': 'http://127.0.0.1:4000',
      '/graph': 'http://127.0.0.1:4000',
      '/quiz-history': 'http://127.0.0.1:4000',
    },
  },
});
