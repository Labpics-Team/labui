import type { TypographyConfig } from '../config/types.js';
import { num, rem } from './format.js';
import type { FluidBounds, ResolvedToken } from './token.js';

/**
 * Build the fluid typography scale — a continuous gradient, not breakpoints.
 *
 * For each signed step `n` from `-stepsDown` to `+stepsUp`:
 *   minPx(n) = basePx * ratioMin^n     (narrow-anchor floor; damped)
 *   maxPx(n) = basePx * ratioMax^n     (wide-anchor ceiling)
 *
 * The preferred value is the line through (minViewport, minPx) and
 * (maxViewport, maxPx):
 *   slopeVw     = 100 * (maxPx - minPx) / (maxVp - minVp)            // in vw
 *   interceptPx = (minVp*maxPx - maxVp*minPx) / (minVp - maxVp)
 *   interceptRem = interceptPx / remBasePx
 *
 * emitted as: clamp(minRem, slopeVw·vw + interceptRem, maxRem)
 *
 * Because ratioMin < ratioMax, large steps get a disproportionately smaller
 * floor — headings grow slower at narrow widths while step 0 is identical at
 * both anchors. rem is kept in every position so browser zoom scales the text
 * (WCAG 1.4.4). No media queries are produced.
 */
export function buildTypography(config: TypographyConfig): {
  fontSizes: ResolvedToken[];
  lineHeights: ResolvedToken[];
  fontWeights: ResolvedToken[];
  letterSpacings: ResolvedToken[];
  measures: ResolvedToken[];
} {
  assertConfig(config);

  const fontSizes: ResolvedToken[] = [];
  const lineHeights: ResolvedToken[] = [];
  const letterSpacings: ResolvedToken[] = [];

  // Font-weight scale: unitless number tokens, config order preserved. Value is
  // the raw weight (e.g. 600), so a literal `font-weight: 600` becomes a 1:1
  // token reference with no visual change.
  const fontWeights: ResolvedToken[] = Object.entries(config.weights).map(([name, weight]) => ({
    kind: 'font-weight',
    name,
    cssValue: num(weight),
    numeric: weight,
    dtcgType: 'number',
  }));

  for (let step = -config.stepsDown; step <= config.stepsUp; step++) {
    const name = labelFor(config, step);
    const bounds = fluidBounds(config, step);

    fontSizes.push({
      kind: 'font-size',
      name,
      cssValue: clampString(config, bounds),
      // A fluid step has no single value — leave numeric undefined; tests assert
      // monotonicity by evaluating the clamp at a width (see effectiveSizePx).
      dtcgType: 'dimension',
      fluid: bounds,
    });

    // Line-height as a unitless multiplier of the step's mid-size, banded by
    // step. Unitless so it tracks the fluid font-size automatically.
    const multiplier = lineHeightMultiplier(config, step);
    lineHeights.push({
      kind: 'line-height',
      name,
      cssValue: num(multiplier),
      numeric: multiplier,
      dtcgType: 'number',
    });

    // Оптический трекинг парно к размеру (ось letter-spacing, 2026-07-03):
    // мелкие кегли разрежаются, крупные ужимаются. Значение в em — следует
    // за рендерным размером; репрезентативный пиксель шага — широкий якорь
    // (канонический модуль шкалы; для фиксированных суб-базовых он и есть
    // единственный размер).
    letterSpacings.push({
      kind: 'letter-spacing',
      name,
      cssValue: `${num(round4(opticalTrackingEm(bounds.maxPx)))}em`,
      numeric: round4(opticalTrackingEm(bounds.maxPx)),
      dtcgType: 'dimension',
    });
  }

  // Мера строки (line measure): классическая типографская вилка 45–75
  // знаков на строку, 66 — идеал (Bringhurst, «The Elements of Typographic
  // Style» §2.1.2). `ch` — ширина «0» текущего шрифта: мера следует и за
  // гарнитурой, и за кеглем.
  const measures: ResolvedToken[] = [
    { kind: 'measure', name: 'narrow', cssValue: '45ch', numeric: 45, dtcgType: 'dimension' },
    { kind: 'measure', name: 'base', cssValue: '66ch', numeric: 66, dtcgType: 'dimension' },
    { kind: 'measure', name: 'wide', cssValue: '75ch', numeric: 75, dtcgType: 'dimension' },
  ];

  return { fontSizes, lineHeights, fontWeights, letterSpacings, measures };
}

/**
 * Оптический трекинг (em) как функция кегля (px):
 *   tracking(z) = A + B·e^(C·z),  A = −0.047, B = 0.1112, C = −0.066
 *
 * КАЛИБРОВКА ИЗ ОТПЕЧАТКОВ Geist (Figma), не по памяти. Спайн — канонический
 * прогресс Display→Text, один стиль на размер (кегль px → letter-spacing px):
 *   112→−5, 80→−4, 64→−3, 48→−2, 32→−1, 24→−0.5, 20→−0.33, 16→−0.25, 14→0, 12→0.
 * Коэффициенты — px-взвешенный МНК по этому спайну (воспроизводимо:
 * scripts/derive-typography.mjs). Форма выбрана честно: exp-к-асимптоте бьёт
 * альтернативу reciprocal (em=A+B/z) по невязкам — SSE 0.19 против 0.35 px²,
 * max|r| 0.285 против 0.362 px. Асимптота A — предел ужатия дисплея; e^(C·z)
 * гаснет с ростом кегля; кривая монотонно убывает и пересекает 0 у ~13px.
 *
 * Невязки по спайну ≤ 0.285px (кегли 80/112: −4/−5px — округлённые дизайнером
 * значения гладкой кривой; «немонотонность» em сверху = это px-квантование,
 * не трещина закона). Контрольные точки (из формулы):
 *   z = 11px → +0.64% em — ниже кроссинга разрежён (учебная оптика мелкого);
 *   z ≈ 13.05px → 0 em   — нуль-кроссинг (captions Figma 12/14 = 0, в пределах округления);
 *   z = 16px → −0.83% em — body слегка ужат;
 *   z = 112px → −4.69% em — почти на асимптоте A = −4.7% em.
 *
 * ВНЕ ЗАКОНА (осознанные исключения, документируются, в фит НЕ входят):
 *   • 16px-Emphasized (Medium) = 0 — ось ВЕСА (Common/Regular 16px = −0.25px
 *     лежит на кривой); одна кривая на размер, вес — отдельная ось.
 *   • Caption/XXS 8px = −0.25px — микро-нудж caption ниже нуль-кроссинга (закон
 *     там разрежает); 8px ниже эмитируемой шкалы (min-шаг ~11px) — на токены не влияет.
 * Формула, не таблица — шкала остаётся непрерывной при любой конфигурации шагов.
 */
export function opticalTrackingEm(sizePx: number): number {
  const A = -0.047;
  const B = 0.1112;
  const C = -0.066;
  return A + B * Math.exp(C * sizePx);
}

function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}

/** Compute the clamp anchors and linear-preferred coefficients for a step. */
export function fluidBounds(config: TypographyConfig, step: number): FluidBounds {
  // Sub-base steps are FIXED rem (slope 0) — аудит 2026-07-03: при базе,
  // одинаковой на обоих якорях, ratioMin^n > ratioMax^n для n < 0, и
  // «флюид» ИНВЕРТИРОВАЛСЯ — подписи/копирайты УМЕНЬШАЛИСЬ с ростом
  // вьюпорта (xs: 13.33px @320 → 12.12px @1240). Демпфирование — закон
  // заголовков (растут медленнее на узких), у суб-базовых кеглей закон
  // обратный: пол разборчивости. Фиксируем на НАРРОУ-якоре (большем из
  // двух, ratioMin^n): расширение вьюпорта никогда не сжимает текст.
  if (step < 0) {
    const px = config.basePx * config.ratioMin ** step;
    return { step, minPx: px, maxPx: px, slopeVw: 0, interceptRem: px / config.remBasePx };
  }
  const minPx = config.basePx * config.ratioMin ** step;
  const maxPx = config.basePx * config.ratioMax ** step;
  const { minViewportPx: minVp, maxViewportPx: maxVp, remBasePx } = config;

  const slopeVw = (100 * (maxPx - minPx)) / (maxVp - minVp);
  const interceptPx = (minVp * maxPx - maxVp * minPx) / (minVp - maxVp);
  const interceptRem = interceptPx / remBasePx;

  return { step, minPx, maxPx, slopeVw, interceptRem };
}

/**
 * The effective rendered size in px at a given viewport width — the clamp
 * evaluated. Used by tests to prove the gradient interpolates and that the
 * scale stays strictly monotonic at any width in the working range.
 */
export function effectiveSizePx(
  config: TypographyConfig,
  step: number,
  viewportPx: number,
): number {
  const { minPx, maxPx, slopeVw, interceptRem } = fluidBounds(config, step);
  const preferredPx = (slopeVw / 100) * viewportPx + interceptRem * config.remBasePx;
  const lo = Math.min(minPx, maxPx);
  const hi = Math.max(minPx, maxPx);
  return Math.min(Math.max(preferredPx, lo), hi);
}

function clampString(config: TypographyConfig, b: FluidBounds): string {
  // Fixed step (sub-base, slope 0): plain rem — clamp вокруг константы был бы
  // шумом; rem сохраняет масштабирование зумом (WCAG 1.4.4).
  if (b.slopeVw === 0 && b.minPx === b.maxPx) {
    return rem(b.minPx / config.remBasePx);
  }
  // CSS clamp requires LOWER <= UPPER; for live-gradient steps the floor is
  // the smaller anchor by magnitude.
  const lowerPx = Math.min(b.minPx, b.maxPx);
  const upperPx = Math.max(b.minPx, b.maxPx);
  const lowerRem = rem(lowerPx / config.remBasePx);
  const upperRem = rem(upperPx / config.remBasePx);
  const interceptSign = b.interceptRem < 0 ? '- ' : '+ ';
  const interceptRem = rem(Math.abs(b.interceptRem));
  const preferred = `${num(b.slopeVw)}vw ${interceptSign}${interceptRem}`;
  return `clamp(${lowerRem}, ${preferred}, ${upperRem})`;
}

function lineHeightMultiplier(config: TypographyConfig, step: number): number {
  // Highest matching threshold wins; bands are evaluated from the top.
  const sorted = [...config.lineHeightBands].sort((a, b) => b.fromStep - a.fromStep);
  for (const band of sorted) {
    if (step >= band.fromStep) return band.multiplier;
  }
  // Unreachable when a band has a sufficiently low fromStep; guard anyway.
  throw new Error(`no line-height band matches step ${step}`);
}

function labelFor(config: TypographyConfig, step: number): string {
  return config.stepLabels[String(step)] ?? String(step);
}

function assertConfig(config: TypographyConfig): void {
  if (!Number.isFinite(config.basePx) || config.basePx <= 0) {
    throw new Error('typography basePx must be positive');
  }
  if (!Number.isInteger(config.stepsDown) || config.stepsDown < 0) {
    throw new Error('typography stepsDown must be a non-negative integer');
  }
  if (!Number.isInteger(config.stepsUp) || config.stepsUp < 0) {
    throw new Error('typography stepsUp must be a non-negative integer');
  }
  if (config.lineHeightBands.length === 0) {
    throw new Error('typography lineHeightBands must not be empty');
  }
  if (config.ratioMin <= 0 || config.ratioMax <= 0) {
    throw new Error('typography ratios must be positive');
  }
  if (config.ratioMin > config.ratioMax) {
    throw new Error(
      `typography ratioMin (${config.ratioMin}) must be <= ratioMax (${config.ratioMax}) for damping`,
    );
  }
  if (config.minViewportPx >= config.maxViewportPx) {
    throw new Error('typography minViewportPx must be < maxViewportPx');
  }
  if (config.remBasePx <= 0) {
    throw new Error('typography remBasePx must be positive');
  }
  const weightEntries = Object.entries(config.weights ?? {});
  if (weightEntries.length === 0) {
    throw new Error('typography weights must define at least one named weight');
  }
  for (const [name, weight] of weightEntries) {
    if (!Number.isInteger(weight) || weight < 1 || weight > 1000) {
      throw new Error(`typography weight "${name}" must be an integer in [1, 1000], got ${weight}`);
    }
  }
}
