import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/config/default-config.js';
import { buildTokens } from '../src/domain/build.js';
import { buildSizes } from '../src/domain/sizes.js';
import { generate } from '../src/generate/index.js';

const tokens = buildTokens(defaultConfig);

/**
 * Шкала размеров контролов — ось размера компонента размерного контракта
 * (docs/dimension-contract.md §2). Канонические px запинены ПРИВЯЗКАМИ живого
 * Figma (замер 2026-07-02, figma-console): контрол-боксы Check и Radio во всех
 * вариантах биндят «🟠 1.1 Dimention» Size/S=12, Size/M=16, Size/L=20
 * (→ Unit px/6, px/7, px/8 @100%). Ступени tiny в контракте НЕТ: tiny-варианты
 * Figma привязаны к Size/M (побайтная копия medium) — пробел, а не значение.
 * Нулевой ступени тоже НЕТ — намеренное исключение из правила «каждая шкала
 * несёт ноль» (контрол нулевого размера вырожден; см. SizesConfig и
 * docs/dimension-contract.md §2) — тест закрепляет ровно 3 ступени осознанно.
 * Перенастройка любой ступени — ДИЗАЙН-решение и обязана упасть здесь первой.
 */
describe('sizes scale — control-box dimensions (Figma Size bindings)', () => {
  const CANON_PX: Readonly<Record<string, number>> = {
    'control-s': 12,
    'control-m': 16,
    'control-l': 20,
    // Ось высот контролов (аудит 2026-07-03): доминирующее семейство button
    // 32/40/48, все на 4px-сетке; DECLARED до появления Figma-якоря высот.
    'control-h-s': 32,
    'control-h-m': 40,
    'control-h-l': 48,
  };

  it('carries exactly the canonical steps with their Figma px values', () => {
    const byName = new Map(tokens.sizes.map((t) => [t.name, t.numeric]));
    expect([...byName.keys()].sort()).toEqual(Object.keys(CANON_PX).sort());
    for (const [name, px] of Object.entries(CANON_PX)) {
      expect(byName.get(name), `--lab-size-${name}`).toBe(px);
    }
  });

  it('is strictly increasing (a size axis must be monotonic)', () => {
    const ordered = [
      'control-s',
      'control-m',
      'control-l',
      'control-h-s',
      'control-h-m',
      'control-h-l',
    ].map((n) => tokens.sizes.find((t) => t.name === n)?.numeric as number);
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i]).toBeGreaterThan(ordered[i - 1] as number);
    }
  });

  it('emits --lab-size-* into every artifact (css / ts / dtcg — no divergence)', () => {
    const { css, ts, dtcg } = generate(defaultConfig);
    expect(css).toContain('--lab-size-control-s: 0.75rem;');
    expect(css).toContain('--lab-size-control-m: 1rem;');
    expect(ts).toContain("'control-s': 'var(--lab-size-control-s)'");
    const doc = JSON.parse(dtcg) as {
      size: Record<string, { $value: { value: number; unit: string } }>;
    };
    expect(doc.size['control-s']?.$value).toEqual({ value: 12, unit: 'px' });
  });

  it('rejects an alias pointing at a missing step (config is validated, not trusted)', () => {
    expect(() =>
      buildSizes({ steps: { 'control-s': 1 }, aliases: { ghost: 'nope' } }),
    ).toThrowError(/missing step "nope"/);
  });
});

/**
 * Concentric-radius floor — §3 of the contract: inner = max(outer − inset, MIN).
 * The MIN is a semantic alias so the whole system can be retuned at one key.
 */
describe('radii — concentric-min alias', () => {
  it('resolves through the xs primitive (2px), never a duplicated value', () => {
    const alias = tokens.radiiAliases.find((a) => a.name === 'concentric-min');
    expect(alias?.target).toBe('xs');
    expect(alias?.cssValue).toBe('var(--lab-radius-xs)');
    const xs = tokens.radii.find((t) => t.name === 'xs');
    expect(xs?.numeric).toBe(2);
  });

  it('emits --lab-radius-concentric-min into the generated CSS', () => {
    const { css } = generate(defaultConfig);
    expect(css).toContain('--lab-radius-concentric-min: var(--lab-radius-xs);');
  });
});
