import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Mount tests use the same conditional browser entry as an application bundle.
  // Explicit /ssr helper tests remain on their server-only entry.
  resolve: { conditions: ['browser'] },
  test: {
    include: ['test/**/*.test.ts'],
    // По умолчанию node (SSR); маунт/полнота требуют DOM — happy-dom по имени файла
    // (устойчиво к переупорядочиванию импортов форматтером, в отличие от in-file директивы).
    environment: 'node',
    environmentMatchGlobs: [
      ['**/mount.test.ts', 'happy-dom'],
      ['**/coverage.test.ts', 'happy-dom'],
    ],
  },
});
