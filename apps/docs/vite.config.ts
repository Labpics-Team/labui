import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// The docs site is a static page for now. The framework (Astro Starlight is the
// reversible default) is decided in the docs research task; Vite serves the
// smoke fixture today without coupling the harness to that choice.
//
// Multi-page: each demo fixture is its own .html entry so every material
// surface (glass, shadow) is verified in isolation without touching the token
// fixtures. `shadow.html` is the shadow-stack demo (elevation cards ×
// light/dark × live light-angle) for the owner's eye.
export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/index.html'),
        glass: resolve(__dirname, 'src/glass.html'),
        shadow: resolve(__dirname, 'src/shadow.html'),
      },
    },
  },
});
