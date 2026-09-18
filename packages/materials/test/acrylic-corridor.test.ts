import { describe, expect, it } from 'vitest';
import {
  ACRYLIC_LUMINOSITY_OPACITY,
  acrylicCorridor,
  blendLuma,
  luminosityBlend,
} from '../src/acrylic-corridor';
import { type Rgba, compositeOver, relativeLuminance } from '../src/luminance';
import {
  FULL_BACKDROP,
  MATERIAL_TIERS,
  bandOverCorridor,
  evaluateTier,
  fillKey,
} from '../src/material-guarantee';
import { readContractMaterials } from './contract-values';

/*
 * Коридор acrylic v2 (ADR-0009) — luminosity-зажим сужает достижимую полосу фона.
 *
 * Классы: А (юнит-якоря на аналитически известных входах), В (property —
 * ТОЧНАЯ симуляция смеси по W3C Compositing обязана лежать внутри выведенного
 * внешнего бокса на псевдослучайном корпусе), интеграция с evaluateTier
 * (зажим никогда не ухудшает вердикт), Б (голден гарантированных пар — в
 * alpha-boundary-стиле, пином ниже).
 *
 * Честность бокса: acrylicCorridor обязан быть ВНЕШНЕЙ границей (может только
 * расширить полосу, никогда не сузить её мимо достижимого) — направление
 * отказа то же, что у cornerCorridor: гарантия не переобещает.
 */

const white: Rgba = { r: 255, g: 255, b: 255, a: 1 };
const black: Rgba = { r: 0, g: 0, b: 0, a: 1 };

/** mulberry32 — детерминированный PRNG теста (сид фиксирован: воспроизводимость). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d_2b_79_f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

describe('acrylicCorridor — аналитические якоря (класс А)', () => {
  it('непрозрачный белый flood при opacity 1 схлопывает коридор в точку белого', () => {
    const c = acrylicCorridor(white, 1);
    for (const ch of ['r', 'g', 'b'] as const) {
      expect(c.min[ch]).toBeCloseTo(255, 6);
      expect(c.max[ch]).toBeCloseTo(255, 6);
    }
  });

  it('непрозрачный чёрный flood при opacity 1 схлопывает коридор в точку чёрного', () => {
    const c = acrylicCorridor(black, 1);
    for (const ch of ['r', 'g', 'b'] as const) {
      expect(c.min[ch]).toBeCloseTo(0, 6);
      expect(c.max[ch]).toBeCloseTo(0, 6);
    }
  });

  it('flood-opacity 0 вырождается ровно в полный коридор [чёрный, белый]', () => {
    const c = acrylicCorridor(white, 0);
    expect(c.min).toEqual(FULL_BACKDROP.min);
    expect(c.max).toEqual(FULL_BACKDROP.max);
  });

  it('сила зажима монотонна: больший αf — не более широкая полоса по каждому каналу', () => {
    const flood: Rgba = { r: 252, g: 252, b: 252, a: 0.8 };
    let prevWidth = Number.POSITIVE_INFINITY;
    for (const opacity of [0, 0.25, 0.5, 0.75, 1]) {
      const c = acrylicCorridor(flood, opacity);
      const width = c.max.r - c.min.r + (c.max.g - c.min.g) + (c.max.b - c.min.b);
      expect(width).toBeLessThanOrEqual(prevWidth + 1e-9);
      prevWidth = width;
    }
  });

  it('альфа flood-цвета входит в силу зажима (rgba-тинт контракта ослабляет αf)', () => {
    const sheer: Rgba = { r: 252, g: 252, b: 252, a: 0.3 };
    const dense: Rgba = { r: 252, g: 252, b: 252, a: 0.9 };
    const cSheer = acrylicCorridor(sheer, 1);
    const cDense = acrylicCorridor(dense, 1);
    expect(cSheer.max.r - cSheer.min.r).toBeGreaterThan(cDense.max.r - cDense.min.r);
  });
});

describe('luminosityBlend — точная симуляция W3C (класс В: bound обязан держать её)', () => {
  it('смесь сохраняет blend-луму источника при αf=1 (SetLum-инвариант)', () => {
    const rng = mulberry32(0xa11ce);
    for (let i = 0; i < 2_000; i++) {
      const backdrop: Rgba = { r: rng() * 255, g: rng() * 255, b: rng() * 255, a: 1 };
      const flood: Rgba = { r: rng() * 255, g: rng() * 255, b: rng() * 255, a: 1 };
      const out = luminosityBlend(backdrop, flood, 1);
      expect(blendLuma(out)).toBeCloseTo(blendLuma(flood), 4);
    }
  });

  it('каждый канал точной смеси лежит внутри внешнего бокса acrylicCorridor', () => {
    const rng = mulberry32(0xf1a75);
    const eps = 1e-6 * 255;
    let worstLower = Number.NEGATIVE_INFINITY;
    let worstUpper = Number.NEGATIVE_INFINITY;
    let lowerWitness = '';
    let upperWitness = '';
    for (let i = 0; i < 20_000; i++) {
      const backdrop: Rgba = { r: rng() * 255, g: rng() * 255, b: rng() * 255, a: 1 };
      const flood: Rgba = { r: rng() * 255, g: rng() * 255, b: rng() * 255, a: rng() };
      const opacity = rng();
      const corridor = acrylicCorridor(flood, opacity);
      const out = luminosityBlend(backdrop, flood, opacity);
      for (const ch of ['r', 'g', 'b'] as const) {
        const lowerViolation = corridor.min[ch] - eps - out[ch];
        const upperViolation = out[ch] - corridor.max[ch] - eps;
        if (lowerViolation > worstLower) {
          worstLower = lowerViolation;
          lowerWitness = `sample=${i} channel=${ch} out=${out[ch]} min=${corridor.min[ch]}`;
        }
        if (upperViolation > worstUpper) {
          worstUpper = upperViolation;
          upperWitness = `sample=${i} channel=${ch} out=${out[ch]} max=${corridor.max[ch]}`;
        }
      }
    }
    expect(worstLower, lowerWitness).toBeLessThanOrEqual(0);
    expect(worstUpper, upperWitness).toBeLessThanOrEqual(0);
  });

  it('WCAG-полоса композита над коридором накрывает точную смесь (уровень гарантии)', () => {
    const rng = mulberry32(0xbeef1);
    const tint: Rgba = { r: 245, g: 245, b: 246, a: 0.6 };
    const flood: Rgba = { r: 245, g: 245, b: 246, a: 0.6 };
    const { effLow, effHigh } = bandOverCorridor(
      tint,
      acrylicCorridor(flood, ACRYLIC_LUMINOSITY_OPACITY),
    );
    for (let i = 0; i < 20_000; i++) {
      const backdrop: Rgba = { r: rng() * 255, g: rng() * 255, b: rng() * 255, a: 1 };
      const clamped = luminosityBlend(backdrop, flood, ACRYLIC_LUMINOSITY_OPACITY);
      const y = relativeLuminance(compositeOver(tint, clamped));
      expect(y).toBeGreaterThanOrEqual(effLow - 1e-6);
      expect(y).toBeLessThanOrEqual(effHigh + 1e-6);
    }
  });
});

describe('голден гарантий acrylic v2 (класс Б — замок против тихого дрейфа контракта)', () => {
  /*
   * Замороженный вердикт по КАЖДОЙ паре тема×tier на текущих PROVISIONAL
   * альфах контракта при Λ = ACRYLIC_LUMINOSITY_OPACITY = 0.7. Смена альф
   * поездом colors или смена Λ обязана перещёлкнуть этот замок ГРОМКО.
   * Ключевой факт зажима: light/soft и dark/subtle — негарантированные на
   * стекле — на acrylic v2 ПОЛУЧАЮТ гарантию (4.059→4.753 и 3.577→5.320).
   */
  const EXPECTED: Record<string, { worst: string; guaranteed: boolean }> = {
    'light/base': { worst: '6.385', guaranteed: true },
    'light/muted': { worst: '6.947', guaranteed: true },
    'light/soft': { worst: '4.753', guaranteed: true },
    'light/subtle': { worst: '1.285', guaranteed: false },
    'light/elevated': { worst: '15.592', guaranteed: true },
    'dark/base': { worst: '13.056', guaranteed: true },
    'dark/muted': { worst: '11.129', guaranteed: true },
    'dark/soft': { worst: '8.208', guaranteed: true },
    'dark/subtle': { worst: '5.320', guaranteed: true },
    'dark/elevated': { worst: '2.876', guaranteed: false },
  };

  const { fills, labelCandidatesByTheme } = readContractMaterials();

  it('вердикты и worst-контрасты соответствуют замороженной таблице', () => {
    for (const theme of ['light', 'dark'] as const) {
      const candidates = labelCandidatesByTheme.get(theme);
      if (candidates === undefined) throw new Error(`no candidates for ${theme}`);
      for (const tier of MATERIAL_TIERS) {
        const key = fillKey(theme, tier);
        const fill = fills.get(key);
        if (fill === undefined) throw new Error(`no fill for ${key}`);
        const verdict = evaluateTier(tier, theme, fill, candidates, {
          backdrop: acrylicCorridor(fill.tint, ACRYLIC_LUMINOSITY_OPACITY),
        });
        const expected = EXPECTED[key];
        if (expected === undefined) throw new Error(`no expectation for ${key}`);
        expect(`${key} ${verdict.worstContrast.toFixed(3)}`).toBe(`${key} ${expected.worst}`);
        expect(`${key} ${verdict.guaranteed}`).toBe(`${key} ${expected.guaranteed}`);
      }
    }
  });

  it('зажим возвращает гарантию ровно парам light/soft и dark/subtle', () => {
    const flipped: string[] = [];
    for (const theme of ['light', 'dark'] as const) {
      const candidates = labelCandidatesByTheme.get(theme);
      if (candidates === undefined) throw new Error(`no candidates for ${theme}`);
      for (const tier of MATERIAL_TIERS) {
        const key = fillKey(theme, tier);
        const fill = fills.get(key);
        if (fill === undefined) throw new Error(`no fill for ${key}`);
        const full = evaluateTier(tier, theme, fill, candidates);
        const clamped = evaluateTier(tier, theme, fill, candidates, {
          backdrop: acrylicCorridor(fill.tint, ACRYLIC_LUMINOSITY_OPACITY),
        });
        if (full.guaranteed !== clamped.guaranteed) flipped.push(key);
      }
    }
    expect(flipped.sort()).toEqual(['dark/subtle', 'light/soft']);
  });
});

describe('интеграция с evaluateTier — зажим не ухудшает ни один вердикт контракта', () => {
  const { fills, labelCandidatesByTheme } = readContractMaterials();

  it('worstContrast с acrylic-коридором ≥ worstContrast с полным коридором', () => {
    for (const theme of ['light', 'dark'] as const) {
      const candidates = labelCandidatesByTheme.get(theme);
      if (candidates === undefined) throw new Error(`no candidates for ${theme}`);
      for (const tier of MATERIAL_TIERS) {
        const fill = fills.get(fillKey(theme, tier));
        if (fill === undefined) throw new Error(`no fill for ${fillKey(theme, tier)}`);
        const full = evaluateTier(tier, theme, fill, candidates);
        const clamped = evaluateTier(tier, theme, fill, candidates, {
          backdrop: acrylicCorridor(fill.tint, ACRYLIC_LUMINOSITY_OPACITY),
        });
        expect(clamped.worstContrast).toBeGreaterThanOrEqual(full.worstContrast - 1e-9);
      }
    }
  });
});
