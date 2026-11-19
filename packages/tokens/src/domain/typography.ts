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
  fonts: ResolvedToken[];
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

    // Оптический интерлиньяж от кегля (не банды): множитель считается по
    // репрезентативному кеглю шага (широкий якорь — канонический модуль шкалы) и
    // базовому кеглю. Безразмерный, поэтому следует за флюидным font-size.
    const multiplier = round4(lineHeightOptical(bounds.maxPx, config.basePx));
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

  // Оболочка шрифта: семейство (фолбэк-стек) и OpenType-фичи. Строковые токены —
  // cssValue уже готовая CSS-строка; stringValue несёт DTCG-нативное значение
  // (массив имён для fontFamily, строку для fontFeatureSettings). Имена дают
  // ровно --lab-font-family / --lab-font-family-mono / --lab-font-feature-<role>.
  const fonts: ResolvedToken[] = [
    {
      kind: 'font',
      name: 'family',
      cssValue: cssFamilyStack(config.fontFamily.sans),
      stringValue: config.fontFamily.sans,
      dtcgType: 'fontFamily',
    },
    {
      kind: 'font',
      name: 'family-mono',
      cssValue: cssFamilyStack(config.fontFamily.mono),
      stringValue: config.fontFamily.mono,
      dtcgType: 'fontFamily',
    },
    ...Object.entries(config.fontFeatures).map(
      ([role, value]): ResolvedToken => ({
        kind: 'font',
        name: `feature-${role}`,
        cssValue: value,
        stringValue: value,
        dtcgType: 'fontFeatureSettings',
      }),
    ),
  ];

  return { fontSizes, lineHeights, fontWeights, letterSpacings, measures, fonts };
}

/**
 * CSS-стек семейств: имена через запятую, с кавычками там, где имя НЕ является
 * одиночным CSS-идентификатором (пробелы → кавычки: 'Geist Mono'). Дженерики
 * (`sans-serif`, `ui-monospace`) и `-apple-system` — валидные идентификаторы,
 * остаются без кавычек (кавычки на дженерике сломали бы его семантику).
 */
function cssFamilyStack(names: readonly string[]): string {
  return names.map(cssFamilyName).join(', ');
}

function cssFamilyName(name: string): string {
  return /^-?[a-zA-Z][a-zA-Z0-9-]*$/.test(name) ? name : `'${name}'`;
}

/**
 * Continuous tracking heuristic for configurable fluid scale steps.
 * Kept for API compatibility; this is not a projection of authored text styles.
 * A size-only function cannot represent both Regular 16/24/-0.25 and
 * Medium 16/24/0. Use text-styles.json for authored UI roles. An interval error
 * accumulates across a string; a small per-interval residual is not fidelity.
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

/**
 * Legacy continuous leading heuristic for configurable fluid steps.
 * This model is not the authored role contract: e.g. Caption/S has its own
 * leading and body/emphasis cannot be recovered from font size alone.
 */
export function lineHeightOptical(sizePx: number, basePx: number): number {
  const SOLID = 1;
  const READ_AMP = 0.5; // body → SOLID + 0.5 = 1.5 (ровно)
  const READ_SIGMA = 0.05; // ширина надбавки в log-кегле (гаснет к соседнему шагу)
  const KNEE_MULT = 5; // колено суб-solid = base·5 (80px при base 16)
  const TAPER_K = 0.4246; // = (1 − 96/112)/ln(112/80), из отпечатка Display/6XL
  const u = Math.log(sizePx / basePx);
  const reading = READ_AMP * Math.exp(-0.5 * (u / READ_SIGMA) ** 2);
  const taper = TAPER_K * Math.max(0, u - Math.log(KNEE_MULT));
  return SOLID + reading - taper;
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
  // Семейства: оба стека непусты (пустой стек = текст без фолбэка, невидимка при
  // не загруженном шрифте) и завершены аварийным дженериком.
  const GENERICS = new Set([
    'sans-serif',
    'serif',
    'monospace',
    'system-ui',
    'ui-monospace',
    'ui-sans-serif',
    'ui-serif',
    'cursive',
    'fantasy',
  ]);
  for (const key of ['sans', 'mono'] as const) {
    const stack = config.fontFamily?.[key];
    if (!Array.isArray(stack) || stack.length === 0) {
      throw new Error(`typography fontFamily.${key} must be a non-empty stack`);
    }
    if (!GENERICS.has(stack[stack.length - 1] as string)) {
      throw new Error(
        `typography fontFamily.${key} must end with a generic fallback (e.g. ${key === 'mono' ? 'monospace' : 'sans-serif'}), got "${stack[stack.length - 1]}"`,
      );
    }
  }
  // Фичи: значения — непустые строки (валидный font-feature-settings).
  for (const [role, value] of Object.entries(config.fontFeatures ?? {})) {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`typography fontFeatures "${role}" must be a non-empty string`);
    }
  }
}
