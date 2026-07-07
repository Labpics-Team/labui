import { defineConfig } from 'vitest/config';

export default defineConfig({
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
