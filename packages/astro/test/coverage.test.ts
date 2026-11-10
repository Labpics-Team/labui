/**
 * Полнота покрытия: каждый компонент ядра (по манифесту-SSOT) имеет и SSR-функцию
 * renderX, и файл `.astro`. Ловит расхождение, если элемент добавлен в ядро, но
 * Astro-обёртки не перегенерированы.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as ssr from '../src/ssr.js';

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(
  readFileSync(join(here, '..', '..', 'adapter-codegen', 'manifest.generated.json'), 'utf8'),
) as { components: Array<{ pascal: string }> };

describe('полнота Astro-адаптера', () => {
  it('каждый компонент ядра имеет SSR-функцию renderX', () => {
    const exported = ssr as Record<string, unknown>;
    const missing = manifest.components
      .map((c) => `render${c.pascal}`)
      .filter((name) => exported[name] === undefined);
    expect(missing, `нет SSR-функций: ${missing.join(', ')}`).toEqual([]);
  });

  it('каждый компонент ядра имеет .astro-файл', () => {
    const missing = manifest.components
      .map((c) => c.pascal)
      .filter((pascal) => !existsSync(join(here, '..', 'src', 'astro', `${pascal}.astro`)));
    expect(missing, `нет .astro: ${missing.join(', ')}`).toEqual([]);
  });

  it('в манифесте 28 компонентов', () => {
    expect(manifest.components).toHaveLength(28);
  });
});
