import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getViteConfig } from 'astro/config';
import hydrate from './src/hydrate.js';

const here = dirname(fileURLToPath(import.meta.url));

// getViteConfig подключает плагины Astro, чтобы .astro компилились в vitest (Container API).
export default getViteConfig(
  {
    // `.astro` импортят @labpics/ui-astro/ssr; в тесте резолвим на исходник, чтобы не
    // зависеть от предварительной сборки dist.
    resolve: {
      alias: {
        '@labpics/ui-astro/ssr': join(here, 'src', 'ssr.ts'),
      },
    },
    test: {
      include: ['test/**/*.test.ts'],
      environment: 'node',
      environmentMatchGlobs: [['**/hydration.test.ts', 'happy-dom']],
    },
  },
  { integrations: [hydrate()] },
);
