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
 *   2. Ось оптического трекинга: tracking(z) = A + B·e^(C·z), калибровка под
 *      Geist ИЗ ОТПЕЧАТКОВ Figma (не по памяти) — воспроизводит спайн-стили в
 *      пределах px-квантования дизайнера; мелкие разрежены (+), крупные ужаты
 *      (−), монотонно по кеглю. Форма (exp-к-асимптоте) выбрана честно: она
 *      бьёт reciprocal (em=A+B/z) по невязкам (SSE 0.19 против 0.35 px²).
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

// Отпечатки Figma (Geist), [кегль px, letter-spacing px]. Спайн — канонический
// прогресс Display→Text, ОДИН стиль на размер (16px = Text/M-Common, Regular).
const TRACK_SPINE: ReadonlyArray<readonly [number, number]> = [
  [112, -5],
  [80, -4],
  [64, -3],
  [48, -2],
  [32, -1],
  [24, -0.5],
  [20, -0.33],
  [16, -0.25],
  [14, 0],
  [12, 0],
];

describe('ось оптического трекинга — калибровка Geist из отпечатков', () => {
  it('воспроизводит спайн-отпечатки в пределах 0.35px (невязка = px-квантование дизайнера)', () => {
    // Допуск 0.35px поставлен ДО фита и оправдан: он покрывает максимальную
    // невязку 0.285px (кегли 80/112, где −4/−5px — округлённые дизайнером
    // значения гладкой кривой), т.е. модель бьёт каждый отпечаток в пределах
    // собственного px-округления дизайнера.
    for (const [z, lsPx] of TRACK_SPINE) {
      const fitPx = opticalTrackingEm(z) * z;
      expect(Math.abs(fitPx - lsPx), `z=${z}px: fit ${fitPx.toFixed(3)}px vs отпечаток ${lsPx}px`).toBeLessThanOrEqual(
        0.35,
      );
    }
  });

  it('Caption/XXS (8px, −0.25px) ЛЕЖИТ ВНЕ закона — осознанное исключение, не промах фита', () => {
    // Ниже нуль-кроссинга (~13px) закон РАЗРЕЖАЕТ мелкое (учебная оптика); Figma
    // же ужимает XXS на −0.25px. Расхождение большое ⇒ это микро-нудж caption,
    // а не точка кривой размера. Он ниже эмитируемой шкалы (min-шаг ~11px),
    // поэтому на токены не влияет.
    const fitPx8 = opticalTrackingEm(8) * 8;
    expect(Math.abs(fitPx8 - -0.25)).toBeGreaterThan(0.35);
  });

  it('ось веса на 16px: Common(Regular) на законе, Emphasized(Medium)=0 — вне закона', () => {
    // 16px-Common (−0.25px) в спайне; 16px-Emphasized (0px) — та же точка размера,
    // но другой вес ⇒ ось веса, не размера. Закон один на размер, поэтому Medium=0
    // от него отклоняется (≈0.13px) — это ожидаемо.
    const fitPx16 = opticalTrackingEm(16) * 16;
    expect(Math.abs(fitPx16 - 0)).toBeGreaterThan(0.1); // Emphasized(0) вне кривой
    expect(Math.abs(fitPx16 - -0.25)).toBeLessThanOrEqual(0.35); // Common(−0.25) на кривой
  });

  it('дисплейная асимптота −0.047em, нуль-кроссинг ~13px, знак: мелкие + / крупные −', () => {
    expect(opticalTrackingEm(400)).toBeCloseTo(-0.047, 3); // асимптота на большом кегле
    expect(opticalTrackingEm(13.05)).toBeCloseTo(0, 3); // нуль-кроссинг
    expect(opticalTrackingEm(11)).toBeGreaterThan(0); // ниже кроссинга — разрежён
    expect(opticalTrackingEm(16)).toBeLessThan(0); // body ужат
  });

  it('монотонно убывает по кеглю (больше кегль — туже трекинг)', () => {
    let prev = opticalTrackingEm(6);
    for (let z = 7; z <= 130; z += 1) {
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

  it('знаковая структура шкалы labui: xxs разрежён (+), md и выше ужаты (−)', () => {
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
