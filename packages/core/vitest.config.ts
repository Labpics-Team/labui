import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@labpics/ui-core/shared': fileURLToPath(new URL('./src/shared.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['test/**/*.test.ts'],
          exclude: [...configDefaults.exclude, 'test/packed-*.test.ts'],
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          name: 'packed',
          include: ['test/packed-*.test.ts'],
          // Real package builds and consumer compilers share the runner's CPU budget.
          pool: 'forks',
          poolOptions: { forks: { singleFork: true, isolate: true } },
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
