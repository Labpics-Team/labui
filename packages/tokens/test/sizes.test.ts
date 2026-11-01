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
 * docs/dimension-contract.md §2).
 * Расширение таксономии #137 (регенерация b69c000, аудит 2026-07-09): шкала
 * несёт все оси размерного контракта; оси без Figma-якоря помечены DECLARED.
 * Перенастройка любой ступени — ДИЗАЙН-решение и обязана упасть здесь первой.
 */
describe('sizes scale — control-box dimensions (Figma Size bindings)', () => {
  const CANON_PX: Readonly<Record<string, number>> = {
    // Глиф-бокс контрола: Figma-биндинги Size/S=12, Size/M=16, Size/L=20;
    // xl=24 — DECLARED (аудит #137), продолжение 4px-прогрессии.
    'control-s': 12,
    'control-m': 16,
    'control-l': 20,
    'control-xl': 24,
    // Ось высот контролов (аудит 2026-07-03): доминирующее семейство button
    // 32/40/48, все на 4px-сетке; DECLARED до появления Figma-якоря высот.
    'control-h-s': 32,
    'control-h-m': 40,
    'control-h-l': 48,
    // Switch при Unit 100%: docs/reference/design-baseline.md (2026-10-30).
    'switch-track-s': 28,
    'switch-track-m': 36,
    'switch-track-l': 44,
    'switch-track-h-s': 16,
    'switch-track-h-m': 20,
    'switch-track-h-l': 24,
    'switch-thumb-s': 12,
    'switch-thumb-m': 16,
    'switch-thumb-l': 20,
    'switch-row': 24,
    // Независимая роль сохраняет существующую геометрию Combobox.
    'combobox-trigger': 36,
    // Loader: толщина штриха спиннера (DECLARED).
    'loader-stroke-s': 2,
    'loader-stroke-m': 3,
    'loader-stroke-l': 4,
    // Checkbox tiny: единственная легитимная под-S ступень глиф-бокса
    // (плотные таблицы); НЕ входит в ось control-* сознательно.
    'checkbox-tiny': 14,
    // Avatar и статус-точка (DECLARED).
    'avatar-s': 28,
    'avatar-m': 40,
    'avatar-l': 56,
    'avatar-dot-s': 10,
    'avatar-dot-m': 12,
    'avatar-dot-l': 16,
    // Оверлеи: ширины поповеров/меню/панелей, шаг в rem-единицах имени
    // (overlay-N = N rem), монотонная лестница 11→40 (DECLARED).
    'overlay-11': 176,
    'overlay-12': 192,
    'overlay-14': 224,
    'overlay-16': 256,
    'overlay-18': 288,
    'overlay-20': 320,
    'overlay-22': 352,
    'overlay-24': 384,
    'overlay-28': 448,
    'overlay-32': 512,
    'overlay-40': 640,
  };

  it('carries exactly the canonical steps with their Figma px values', () => {
    const byName = new Map(tokens.sizes.map((t) => [t.name, t.numeric]));
    expect([...byName.keys()].sort()).toEqual(Object.keys(CANON_PX).sort());
    for (const [name, px] of Object.entries(CANON_PX)) {
      expect(byName.get(name), `--lab-size-${name}`).toBe(px);
    }
  });

  it('is strictly increasing (a size axis must be monotonic)', () => {
    // Две НЕЗАВИСИМЫЕ оси: габарит глиф-бокса и высота контрола. Монотонность
    // проверяется пер-осно — кросс-осевое сравнение (control-l < control-h-s)
    // было бы случайным инвариантом текущих чисел, не контрактом.
    const axes = [
      ['control-s', 'control-m', 'control-l', 'control-xl'],
      ['control-h-s', 'control-h-m', 'control-h-l'],
      ['switch-track-s', 'switch-track-m', 'switch-track-l'],
      ['switch-track-h-s', 'switch-track-h-m', 'switch-track-h-l'],
      ['switch-thumb-s', 'switch-thumb-m', 'switch-thumb-l'],
      ['loader-stroke-s', 'loader-stroke-m', 'loader-stroke-l'],
      ['avatar-s', 'avatar-m', 'avatar-l'],
      ['avatar-dot-s', 'avatar-dot-m', 'avatar-dot-l'],
      // Оверлеи: полная лестница — имя (rem) и значение растут вместе.
      [
        'overlay-11',
        'overlay-12',
        'overlay-14',
        'overlay-16',
        'overlay-18',
        'overlay-20',
        'overlay-22',
        'overlay-24',
        'overlay-28',
        'overlay-32',
        'overlay-40',
      ],
    ];
    for (const axis of axes) {
      const ordered = axis.map((n) => tokens.sizes.find((t) => t.name === n)?.numeric as number);
      for (let i = 1; i < ordered.length; i++) {
        expect(ordered[i], axis.join('<')).toBeGreaterThan(ordered[i - 1] as number);
      }
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
  it('resolves through the xxs primitive (2px), never a duplicated value', () => {
    const alias = tokens.radiiAliases.find((a) => a.name === 'concentric-min');
    expect(alias?.target).toBe('xxs');
    expect(alias?.cssValue).toBe('var(--lab-radius-xxs)');
    const xxs = tokens.radii.find((t) => t.name === 'xxs');
    expect(xxs?.numeric).toBe(2);
  });

  it('emits --lab-radius-concentric-min into the generated CSS', () => {
    const { css } = generate(defaultConfig);
    expect(css).toContain('--lab-radius-concentric-min: var(--lab-radius-xxs);');
  });
});
