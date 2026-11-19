import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Solid публикует условные экспорты server/client. Для маунт-тестов нужен КЛИЕНТСКИЙ
  // билд solid-js/web (иначе render() кидает «Client-only API on the server»).
  resolve: {
    conditions: ['development', 'browser'],
  },
  // Keep transitive solid-js/web imports under the same browser resolver. An
  // externalized web build otherwise imports Node's server reactive runtime.
  ssr: { noExternal: ['solid-js'] },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    environmentMatchGlobs: [
      ['**/mount.test.ts', 'happy-dom'],
      ['**/coverage.test.ts', 'happy-dom'],
    ],
  },
});
