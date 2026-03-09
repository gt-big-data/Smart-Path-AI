import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/chat': 'http://127.0.0.1:4000',
      '/upload': 'http://127.0.0.1:4000',
      '/auth': 'http://127.0.0.1:4000',
      '/graph': 'http://127.0.0.1:4000',
      '/progress': 'http://127.0.0.1:4000',
      '/quiz-history': 'http://127.0.0.1:4000',
    },
  },
});
