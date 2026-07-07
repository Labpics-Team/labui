import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Препроцессинг TS в <script lang="ts"> сгенерированных обёрток.
export default {
  preprocess: vitePreprocess(),
};
