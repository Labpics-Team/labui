import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// Build the Vue SSR entry to a node-runnable bundle. lab-button is declared a
// custom element at COMPILE time (the only place Vue's template compiler reads
// it), so Vue does not try to resolve it as a component.
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === 'lab-button',
        },
      },
    }),
  ],
  build: {
    ssr: true,
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL('./entry-server.ts', import.meta.url)),
      output: { entryFileNames: 'entry-server.mjs', format: 'es' },
      // Keep Lit + the Lit-SSR engine external so the DOM shim installs once in
      // the node process, not bundled/duplicated.
      external: [/^lit/, /^@lit-labs\/ssr/],
    },
    target: 'node20',
    minify: false,
  },
});
