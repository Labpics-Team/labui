import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

// Build the Svelte 5 SSR entry to a node-runnable bundle. The svelte plugin
// compiles App.svelte in SSR (generate: 'server') mode here.
export default defineConfig({
  plugins: [svelte({ compilerOptions: { css: 'injected' } })],
  build: {
    ssr: true,
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL('./entry-server.ts', import.meta.url)),
      output: { entryFileNames: 'entry-server.mjs', format: 'es' },
      external: [/^lit/, /^@lit-labs\/ssr/],
    },
    target: 'node20',
    minify: false,
  },
});
