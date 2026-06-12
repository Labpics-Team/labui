import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// The docs site is a static page for now. The framework (Astro Starlight is the
// reversible default) is decided in the docs research task; Vite serves the
// smoke fixture today without coupling the harness to that choice.
//
// Multi-page: each demo fixture is its own .html entry so every material
// surface is verified in isolation without touching the token fixtures.
// `materials.html` is the Ambient/Solid material demo (mode + theme switchers,
// product card + sign-in form + the Ambient blur ladder) — it replaces the old
// `glass.html` per the owner's verdict (web glass is native-only). `shadow.html`
// is the shadow-stack demo (elevation cards × light/dark × live light-angle).
export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/index.html'),
        materials: resolve(__dirname, 'src/materials.html'),
        shadow: resolve(__dirname, 'src/shadow.html'),
      },
    },
  },
});
