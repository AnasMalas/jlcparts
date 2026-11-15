import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// `base: './'` keeps every asset URL relative, so the build works unchanged on
// GitHub Pages project sites (https://<user>.github.io/<repo>/) and at a root.
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: { alias: { '@shared': path.resolve(import.meta.dirname, '../shared') } },
  server: { fs: { allow: ['..'] } },
  build: { target: 'es2022', sourcemap: true },
});
