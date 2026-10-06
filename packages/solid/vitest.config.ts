import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Solid публикует условные экспорты server/client. Для маунт-тестов нужен КЛИЕНТСКИЙ
  // билд solid-js/web (иначе render() кидает «Client-only API on the server»).
  resolve: {
    conditions: ['development', 'browser'],
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
          exclude: ['**/mount.test.ts', '**/coverage.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          include: ['test/**/mount.test.ts', 'test/**/coverage.test.ts'],
          environment: 'happy-dom',
        },
      },
    ],
  },
});
