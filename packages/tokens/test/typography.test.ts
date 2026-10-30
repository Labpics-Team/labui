import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/config/default-config.js';
import { resolveConfig } from '../src/config/merge.js';
import {
  buildTypography,
  effectiveSizePx,
  fluidBounds,
  lineHeightOptical,
} from '../src/domain/typography.js';

const ty = defaultConfig.typography;

/** Every signed step index in the configured range, low to high. */
function allSteps(): number[] {
  const steps: number[] = [];
  for (let s = -ty.stepsDown; s <= ty.stepsUp; s++) steps.push(s);
  return steps;
}

describe('fluid typography — gradient model', () => {
  it('base step (0) is exactly 16px and immovable at every width', () => {
    const widths = [ty.minViewportPx, 600, 900, ty.maxViewportPx, 320, 1240];
    for (const w of widths) {
      expect(effectiveSizePx(ty, 0, w)).toBeCloseTo(16, 6);
    }
  });

  it('step +7 reaches ~112px at the wide anchor and is damped to ~57px at the narrow anchor', () => {
    const wide = effectiveSizePx(ty, 7, ty.maxViewportPx);
    const narrow = effectiveSizePx(ty, 7, ty.minViewportPx);
    // Daniel's target: ~112px desktop, ~57px mobile (grows ~2x slower narrow).
    expect(wide).toBeGreaterThan(108);
    expect(wide).toBeLessThan(115);
    expect(narrow).toBeGreaterThan(55);
    expect(narrow).toBeLessThan(60);
    // The whole point of damping: the narrow top is far below the wide top.
    expect(narrow).toBeLessThan(wide * 0.6);
  });

  it('STRICT MONOTONICITY: at ANY width in the working range, every step is larger than the one below it (slopes never cross)', () => {
    const steps = allSteps();
    // Sample densely across [minViewport, maxViewport] plus the exact anchors.
    const widths = new Set<number>([ty.minViewportPx, ty.maxViewportPx]);
    for (let w = ty.minViewportPx; w <= ty.maxViewportPx; w += 5) widths.add(w);

    for (const w of widths) {
      const sizes = steps.map((s) => effectiveSizePx(ty, s, w));
      for (let i = 1; i < sizes.length; i++) {
        expect(
          sizes[i],
          `step ${steps[i]} (${sizes[i]?.toFixed(3)}px) must exceed step ${steps[i - 1]} (${sizes[
            i - 1
          ]?.toFixed(3)}px) at width ${w}px`,
        ).toBeGreaterThan(sizes[i - 1] as number);
      }
    }
  });

  it('monotonicity also holds slightly outside the anchors (clamped region)', () => {
    const steps = allSteps();
    for (const w of [120, 280, 1600, 2560]) {
      const sizes = steps.map((s) => effectiveSizePx(ty, s, w));
      for (let i = 1; i < sizes.length; i++) {
        expect(sizes[i]).toBeGreaterThan(sizes[i - 1] as number);
      }
    }
  });

  it('the gradient actually interpolates: a 400px viewport differs from 1400px for display steps, base does not', () => {
    // Display step moves between widths (continuous interpolation, no steps).
    const display400 = effectiveSizePx(ty, 7, 400);
    const display1400 = effectiveSizePx(ty, 7, 1400);
    expect(display1400).toBeGreaterThan(display400 + 10);

    // A mid step inside the live region interpolates monotonically with width.
    const mid = [400, 700, 1000, 1240].map((w) => effectiveSizePx(ty, 4, w));
    for (let i = 1; i < mid.length; i++) {
      expect(mid[i]).toBeGreaterThan(mid[i - 1] as number);
    }

    // Base is fixed regardless of width.
    expect(effectiveSizePx(ty, 0, 400)).toBeCloseTo(effectiveSizePx(ty, 0, 1400), 6);
  });

  it('emits rem in every clamp position (WCAG zoom) and never a bare vw-only value', () => {
    const { fontSizes } = buildTypography(ty);
    for (const t of fontSizes) {
      // Фиксированные шаги (slope 0): суб-базовые — по аудиту 2026-07-03
      // (инвертированный флюид), база — вырожденный clamp вокруг константы.
      // Оба эмитятся чистым rem; живой градиент — только положительные шаги.
      if (t.fluid === undefined || t.fluid.slopeVw === 0) {
        expect(t.cssValue).toMatch(/^[\d.]+rem$/);
        continue;
      }
      expect(t.cssValue.startsWith('clamp(')).toBe(true);
      // Assert the actual contract per clamp position, not a surrogate count:
      // floor and ceiling are pure rem; the preferred part mixes vw + rem so
      // the gradient moves with the viewport AND scales with user zoom.
      const parts = t.cssValue
        .slice('clamp('.length, -1)
        .split(',')
        .map((p) => p.trim());
      expect(parts, `${t.name} clamp must have 3 parts`).toHaveLength(3);
      const [floor, preferred, ceiling] = parts as [string, string, string];
      expect(floor, `${t.name} floor must be pure rem`).toMatch(/^-?[\d.]+rem$/);
      expect(ceiling, `${t.name} ceiling must be pure rem`).toMatch(/^-?[\d.]+rem$/);
      expect(preferred, `${t.name} preferred must carry vw`).toMatch(/-?[\d.]+vw/);
      expect(preferred, `${t.name} preferred must carry a rem intercept`).toMatch(/[\d.]+rem/);
      expect(preferred, `${t.name} preferred must not use px`).not.toMatch(/px/);
    }
  });

  it('never emits a media query', () => {
    const { fontSizes } = buildTypography(ty);
    for (const t of fontSizes) {
      expect(t.cssValue).not.toContain('@media');
    }
  });

  it('clamp bounds are always ordered lower <= upper (valid CSS clamp)', () => {
    for (const step of allSteps()) {
      const b = fluidBounds(ty, step);
      const lower = Math.min(b.minPx, b.maxPx);
      const upper = Math.max(b.minPx, b.maxPx);
      expect(lower).toBeLessThanOrEqual(upper);
    }
  });

  it('changing ratio in the config re-derives the whole scale (configurability)', () => {
    const flatter = resolveConfig({ typography: { ratioMax: 1.25 } });
    const steeper = resolveConfig({ typography: { ratioMax: 1.4 } });
    const flatTop = effectiveSizePx(flatter.typography, 7, flatter.typography.maxViewportPx);
    const steepTop = effectiveSizePx(steeper.typography, 7, steeper.typography.maxViewportPx);
    expect(steepTop).toBeGreaterThan(flatTop);
    // Base is unaffected by ratio — still 16px both ways.
    expect(effectiveSizePx(flatter.typography, 0, 800)).toBeCloseTo(16, 6);
    expect(effectiveSizePx(steeper.typography, 0, 800)).toBeCloseTo(16, 6);
  });

  it('line-height Geist: body (md) leaded 1.5, дисплей set-solid, мега-дисплей суб-solid', () => {
    const { lineHeights } = buildTypography(ty);
    const byName = new Map(lineHeights.map((t) => [t.name, t.numeric as number]));
    // Body (16px) — читаемая проза, интерлиньяж 1.5 (отпечаток Text/M).
    expect(byName.get('md')).toBeCloseTo(1.5, 3);
    // Заголовки/дисплей набраны СПЛОШНЯКОМ (lh = кегль, 1.0) — отпечатки 20…80px.
    expect(byName.get('lg')).toBeCloseTo(1.0, 3);
    expect(byName.get('4xl')).toBeCloseTo(1.0, 3);
    // Мега-дисплей (6xl, ~112px) — суб-solid 0.857 (отрицательный интерлиньяж),
    // это НЕ 1.2 старой банды: закон из отпечатка Display/6XL 112→96px.
    expect(byName.get('6xl')).toBeCloseTo(0.857, 2);
    expect(byName.get('6xl')).toBeLessThan(1.0);
    // Captions набраны плотно (~solid), не разлохмачены старой 1.5.
    expect(byName.get('xs')).toBeCloseTo(1.0, 2);
  });
});

// Отпечатки Geist [кегль px, line-height px]. Спайн = solid+body (без caption-14,
// задокументированного −2px микро-выброса). Модель воспроизводит их из кегля.
const LH_FP: ReadonlyArray<readonly [number, number]> = [
  [112, 96],
  [80, 80],
  [64, 64],
  [48, 48],
  [32, 32],
  [24, 24],
  [20, 20],
  [16, 24],
  [12, 12],
];

describe('line-height — оптическая модель из отпечатков Geist', () => {
  it('воспроизводит solid/body-отпечатки из кегля (допуск 0.01 мультипликатора)', () => {
    for (const [z, lhPx] of LH_FP) {
      const fit = lineHeightOptical(z, ty.basePx);
      expect(
        Math.abs(fit - lhPx / z),
        `z=${z}px: fit ${fit.toFixed(4)} vs ${(lhPx / z).toFixed(4)}`,
      ).toBeLessThanOrEqual(0.01);
    }
  });

  it('caption-14 (0.857) — задокументированный выброс ВНЕ закона (модель даёт ~solid)', () => {
    // 14px — не шаг эмитируемой шкалы; закон ставит его ~1.0, дизайнер нудж −2px.
    const fit = lineHeightOptical(14, ty.basePx);
    expect(fit).toBeCloseTo(1.0, 1); // модель — почти solid
    expect(Math.abs(fit - 12 / 14)).toBeGreaterThan(0.1); // отпечаток 0.857 вне модели
  });

  it('шкало-инвариантна: при смене базы пик читаемости следует за базой', () => {
    // База 20 → body-надбавка на 20px (не на 16); 16px становится «мельче base» → solid.
    expect(lineHeightOptical(20, 20)).toBeCloseTo(1.5, 3);
    expect(lineHeightOptical(16, 20)).toBeCloseTo(1.0, 1);
  });

  it('динамика: reading-пик на body, solid на дисплее, суб-solid у мега-дисплея', () => {
    expect(lineHeightOptical(16, 16)).toBeCloseTo(1.5, 3); // body
    expect(lineHeightOptical(48, 16)).toBeCloseTo(1.0, 3); // дисплей solid
    expect(lineHeightOptical(112, 16)).toBeLessThan(1.0); // мега суб-solid
    expect(lineHeightOptical(112, 16)).toBeCloseTo(0.857, 2);
  });
});
