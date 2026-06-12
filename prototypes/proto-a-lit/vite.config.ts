import { defineConfig } from 'vite';

// Serves the Button states-matrix demo for the Playwright smoke, mirroring the
// apps/docs harness pattern (vite preview, Chromium) WITHOUT touching apps/docs
// (shared with proto-B). Uses port 4322 so it can't collide with the docs :4321.
export default defineConfig({
  root: 'demo',
  build: {
    outDir: '../dist-demo',
    emptyOutDir: true,
  },
});
