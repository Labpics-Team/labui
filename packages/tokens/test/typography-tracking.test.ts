import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../src/config/merge.js';
import {
  buildTypography,
  effectiveSizePx,
  fluidBounds,
  opticalTrackingEm,
} from '../src/domain/typography.js';

/**
 * Тесты волны типографики (аудит 2026-07-03):
 *   1. Фикс инвертированного флюида: суб-базовые кегли ФИКСИРОВАНЫ (slope 0)
 *      на нарроу-якоре — расширение вьюпорта никогда не сжимает текст.
 *      RED-proof: вернуть старую формулу (ratioMin^n / ratioMax^n оба якоря)
 *      → «фикс на всех ширинах» падает (13.33px @320 против 12.12px @1240).
 *   2. Ось оптического трекинга: tracking(z) = A + B·e^(C·z) (DECLARED-
 *      CALIBRATION, кривая dynamic metrics iA для системных UI-гарнитур) —
 *      мелкие разрежены (+), крупные ужаты (−), монотонно по кеглю.
 *   3. Мера строки: Bringhurst 45–75ch, 66 идеал.
 */

const ty = resolveConfig({}).typography;

describe('фикс инвертированного флюида — суб-базовые кегли', () => {
  it('xs/xxs идентичны на ЛЮБОЙ ширине (slope 0) и равны нарроу-якорю', () => {
    for (const step of [-1, -2]) {
      const atNarrow = effectiveSizePx(ty, step, ty.minViewportPx);
      const atWide = effectiveSizePx(ty, step, ty.maxViewportPx);
      const atMid = effectiveSizePx(ty, step, 800);
      expect(atNarrow).toBeCloseTo(atWide, 9);
      expect(atNarrow).toBeCloseTo(atMid, 9);
      // Нарроу-якорь (больший из двух: пол разборчивости)
      expect(atNarrow).toBeCloseTo(ty.basePx * ty.ratioMin ** step, 9);
    }
  });

  it('прежний инвертированный градиент невозможен: размер никогда не убывает по ширине', () => {
    // Класс-ассерт по всем шагам: f(1240) >= f(320) — старый xs давал 12.12 < 13.33.
    for (let step = -ty.stepsDown; step <= ty.stepsUp; step++) {
      const narrow = effectiveSizePx(ty, step, ty.minViewportPx);
      const wide = effectiveSizePx(ty, step, ty.maxViewportPx);
      expect(wide, `step ${step}: сжатие при расширении вьюпорта`).toBeGreaterThanOrEqual(narrow);
    }
  });

  it('суб-базовые эмитятся чистым rem (без вырожденного clamp), база тоже', () => {
    const { fontSizes } = buildTypography(ty);
    for (const t of fontSizes) {
      const step = t.fluid?.step ?? Number.NaN;
      if (step <= 0) {
        expect(t.cssValue, t.name).toMatch(/^[\d.]+rem$/);
      } else {
        expect(t.cssValue.startsWith('clamp('), t.name).toBe(true);
      }
    }
  });

  it('slope всех шагов ≥ 0 (закон волны: инверсия — класс, не кейс)', () => {
    for (let step = -ty.stepsDown; step <= ty.stepsUp; step++) {
      expect(fluidBounds(ty, step).slopeVw).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('ось оптического трекинга (--lab-letter-spacing-*)', () => {
  it('кривая: разрежение мелких (+), ~нейтраль у ~12px, ужатие крупных до асимптоты −0.0223em', () => {
    expect(opticalTrackingEm(11)).toBeGreaterThan(0); // fine print разрежён
    expect(Math.abs(opticalTrackingEm(12.1))).toBeLessThan(0.001); // ноль кривой
    expect(opticalTrackingEm(16)).toBeLessThan(0); // body слегка ужат (SF-класс)
    expect(opticalTrackingEm(112)).toBeCloseTo(-0.0223, 3); // дисплейная асимптота
  });

  it('монотонно убывает по кеглю (больше кегль — туже трекинг)', () => {
    let prev = opticalTrackingEm(8);
    for (let z = 9; z <= 120; z += 1) {
      const cur = opticalTrackingEm(z);
      expect(cur).toBeLessThan(prev);
      prev = cur;
    }
  });

  it('эмиссия парна кеглям: те же имена шагов, значения в em', () => {
    const { fontSizes, letterSpacings } = buildTypography(ty);
    expect(letterSpacings.map((t) => t.name)).toEqual(fontSizes.map((t) => t.name));
    for (const t of letterSpacings) {
      expect(t.kind).toBe('letter-spacing');
      expect(t.cssValue).toMatch(/^-?[\d.]+em$/);
    }
  });

  it('знаковая структура шкалы labui: xxs/xs разрежены, md и выше ужаты', () => {
    const { letterSpacings } = buildTypography(ty);
    const byName = new Map(letterSpacings.map((t) => [t.name, t.numeric as number]));
    const at = (name: string): number => {
      const v = byName.get(name);
      if (v === undefined) throw new Error(`нет шага ${name}`);
      return v;
    };
    expect(at('xxs')).toBeGreaterThan(0);
    expect(at('md')).toBeLessThan(0);
    expect(at('6xl')).toBeLessThan(at('md'));
  });
});

describe('мера строки (--lab-measure-*)', () => {
  it('вилка Bringhurst: narrow 45ch / base 66ch / wide 75ch', () => {
    const { measures } = buildTypography(ty);
    expect(measures.map((t) => [t.name, t.cssValue])).toEqual([
      ['narrow', '45ch'],
      ['base', '66ch'],
      ['wide', '75ch'],
    ]);
    for (const t of measures) expect(t.kind).toBe('measure');
  });
});
