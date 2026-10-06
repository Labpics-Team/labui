import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getViteConfig } from 'astro/config';

const here = dirname(fileURLToPath(import.meta.url));

// getViteConfig подключает плагины Astro, чтобы .astro компилились в vitest (Container API).
export default getViteConfig({
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
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          include: ['test/**/*.test.ts'],
          exclude: ['**/hydration.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          include: ['test/**/hydration.test.ts'],
          environment: 'happy-dom',
        },
      },
    ],
  },
});
