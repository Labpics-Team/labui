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
    include: ['test/**/*.test.ts'],
    environment: 'node',
    environmentMatchGlobs: [
      ['**/mount.test.ts', 'happy-dom'],
      ['**/coverage.test.ts', 'happy-dom'],
    ],
  },
});
