import { defineConfig } from 'vite';

// The docs site is a static page for now. The framework (Astro Starlight is the
// reversible default) is decided in the docs research task; Vite serves the
// smoke fixture today without coupling the harness to that choice.
export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
