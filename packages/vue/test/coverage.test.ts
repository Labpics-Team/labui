/**
 * Полнота покрытия: каждый компонент ядра (по манифесту-SSOT) представлен экспортом
 * в Vue-адаптере. Ловит расхождение, если элемент добавлен в ядро, но обёртка не
 * перегенерирована. happy-dom (задаётся vitest.config) нужен, т.к. импорт барреля тянет
 * регистрацию элементов (LitElement наследует HTMLElement — в голом node его нет).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as adapter from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(
  readFileSync(join(here, '..', '..', 'adapter-codegen', 'manifest.generated.json'), 'utf8'),
) as { components: Array<{ pascal: string }> };

describe('полнота Vue-адаптера', () => {
  it('каждый компонент ядра имеет обёртку', () => {
    const exported = adapter as Record<string, unknown>;
    const missing = manifest.components
      .map((c) => c.pascal)
      .filter((name) => exported[name] === undefined);
    expect(missing, `нет обёрток: ${missing.join(', ')}`).toEqual([]);
  });

  it('в манифесте 27 компонентов', () => {
    expect(manifest.components).toHaveLength(27);
  });
});
