import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Standalone Vite server for the graph view QA harness. Run from the repo root:
//   npx vite --config qa/harness/vite.config.ts
const repoRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  css: { postcss: repoRoot },
  optimizeDeps: { exclude: ['lucide-react'] },
  server: { port: 5199, strictPort: true, fs: { allow: [repoRoot] } },
});
