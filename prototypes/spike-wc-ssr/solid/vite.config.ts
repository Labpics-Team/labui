import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

// Build the Solid SSR entry to a node-runnable bundle. ssr: true makes the
// solid plugin compile in server mode (renderToString hydration markers).
export default defineConfig({
  plugins: [solid({ ssr: true })],
  build: {
    ssr: true,
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL('./entry-server.tsx', import.meta.url)),
      output: { entryFileNames: 'entry-server.mjs', format: 'es' },
      external: [/^lit/, /^@lit-labs\/ssr/],
    },
    target: 'node20',
    minify: false,
  },
});
