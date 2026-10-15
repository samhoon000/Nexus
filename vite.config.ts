import { defineConfig } from 'vite';

// GitHub Pages serves project sites under /<repo>/. The deploy workflow sets VITE_BASE to that
// path; local dev and preview default to '/'.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  server: {
    host: '127.0.0.1',
    port: 5188,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4188,
    strictPort: true,
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/three')) return 'three';
          return undefined;
        },
      },
    },
  },
});
