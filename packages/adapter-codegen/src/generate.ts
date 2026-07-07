/**
 * CLI-оркестратор: анализирует ядро, пишет манифест и генерирует обёртки всех
 * адаптеров. Запуск: `pnpm --filter @labpics/adapter-codegen generate`.
 *
 * Идемпотентен: файлы пишутся только при изменении содержимого, поэтому повторный
 * прогон без правок ядра не трогает mtime (golden-тест сверяет с этим).
 */
import { writeFileSync } from 'node:fs';
import { buildManifest, serializeManifest } from './build-manifest.js';
import { generateAstro } from './generators/astro.js';
import { generateSolid } from './generators/solid.js';
import { generateSsr } from './generators/ssr.js';
import { generateSvelte } from './generators/svelte.js';
import { generateVue } from './generators/vue.js';
import { manifestPath } from './paths.js';

function main(): void {
  const manifest = buildManifest();
  writeFileSync(manifestPath, serializeManifest(manifest));

  const results: Record<string, number> = {
    vue: generateVue(manifest).length + generateSsr('vue', manifest).length,
    solid: generateSolid(manifest).length + generateSsr('solid', manifest).length,
    svelte: generateSvelte(manifest).length + generateSsr('svelte', manifest).length,
    astro: generateAstro(manifest).length + generateSsr('astro', manifest).length,
  };

  process.stdout.write(`манифест: ${manifest.components.length} компонентов\n`);
  for (const [framework, count] of Object.entries(results)) {
    process.stdout.write(`  ${framework}: изменено файлов — ${count}\n`);
  }
}

main();
