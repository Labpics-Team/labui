import node from '@astrojs/node';
import react from '@astrojs/react';
import { defineConfig } from 'astro/config';

/**
 * Astro 5 SSR fixture for the Mitosis-compiled React Button.
 *
 * The compiled React component is consumed as an Astro ISLAND (`client:load`).
 * Astro server-renders the island's HTML, then hydrates only that island —
 * this is the "React-island" path the task names. The node adapter lets us
 * server-render and read the SSR HTML for the FOUC/SSR criterion.
 */
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  server: { port: 4323, host: '127.0.0.1' },
  vite: {
    // Allow importing the compiled Button + CSS from outside this fixture dir.
    server: { fs: { allow: ['../..'] } },
  },
});
