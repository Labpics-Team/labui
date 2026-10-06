import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // По умолчанию node (SSR); маунт/полнота требуют DOM — happy-dom по имени файла
    // (устойчиво к переупорядочиванию импортов форматтером, в отличие от in-file директивы).
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
