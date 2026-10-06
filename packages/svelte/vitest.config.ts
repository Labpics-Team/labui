import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Плагин компилирует .svelte-обёртки для маунт-тестов.
  plugins: [svelte()],
  // Клиентский билд Svelte для mount() (иначе резолвится server-условие).
  resolve: {
    conditions: ['browser'],
  },
  test: {
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
