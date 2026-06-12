import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// The docs site is a static page for now. The framework (Astro Starlight is the
// reversible default) is decided in the docs research task; Vite serves the
// smoke fixture today without coupling the harness to that choice.
//
// Multi-page: `index.html` is the bootstrap smoke fixture; `shadow.html` is the
// shadow-stack demo (elevation cards × light/dark × live light-angle), for the
// owner's eye and the Playwright shadow smoke.
export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/index.html'),
        shadow: resolve(__dirname, 'src/shadow.html'),
      },
    },
  },
});
