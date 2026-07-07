/**
 * Golden-тест (антидрейф, класс Б): свежая генерация из ядра НЕ меняет ни манифест,
 * ни сгенерированные обёртки в гите. Красный тут = кто-то поменял ядро/генератор, но
 * не перегенерировал (`pnpm --filter @labpics/adapter-codegen generate`). Это бетонирует
 * SSOT: то, что закоммичено, всегда выведено из текущего ядра.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildManifest, serializeManifest } from '../src/build-manifest.js';
import { generateAstro } from '../src/generators/astro.js';
import { generateSolid } from '../src/generators/solid.js';
import { generateSsr } from '../src/generators/ssr.js';
import { generateSvelte } from '../src/generators/svelte.js';
import { generateVue } from '../src/generators/vue.js';
import { manifestPath } from '../src/paths.js';

const manifest = buildManifest();

describe('golden: генерация синхронна с ядром', () => {
  it('манифест в гите совпадает с выведенным из ядра', () => {
    const onDisk = readFileSync(manifestPath, 'utf8');
    expect(serializeManifest(manifest)).toBe(onDisk);
  });

  it('обёртки Vue не требуют перегенерации', () => {
    expect(generateVue(manifest)).toEqual([]);
    expect(generateSsr('vue', manifest)).toEqual([]);
  });

  it('обёртки Solid не требуют перегенерации', () => {
    expect(generateSolid(manifest)).toEqual([]);
    expect(generateSsr('solid', manifest)).toEqual([]);
  });

  it('обёртки Svelte не требуют перегенерации', () => {
    expect(generateSvelte(manifest)).toEqual([]);
    expect(generateSsr('svelte', manifest)).toEqual([]);
  });

  it('обёртки Astro не требуют перегенерации', () => {
    expect(generateAstro(manifest)).toEqual([]);
    expect(generateSsr('astro', manifest)).toEqual([]);
  });
});
