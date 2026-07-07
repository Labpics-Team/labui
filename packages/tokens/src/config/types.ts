/**
 * LabUI token configuration — the single source of truth.
 *
 * One typed config describes every dimension scale declaratively. The generator
 * (see `../generate`) turns this into three artifacts without divergence: CSS
 * custom properties (`--lab-*`), a typed TS module, and a canonical DTCG export.
 *
 * Design rules encoded here (from the epic's cross-cutting principles):
 *  - Everything is rem-relative; interface scaling is root font-size — the code
 *    embodiment of the Figma Unit modes (75/100/116.6/133.3% scale the whole
 *    ladder; see docs/dimension-contract.md).
 *  - Every scale carries an explicit, correct zero token — except `sizes`:
 *    контрол нулевого размера вырожден, нулевая ступень была бы ловушкой
 *    (см. SizesConfig).
 *  - Three languages: primitives -> semantic aliases -> (components consume
 *    semantics only). This file defines primitives and the alias mechanism.
 */

/** Prefix for every generated CSS custom property and DTCG token path segment. */
export const TOKEN_PREFIX = 'lab';

/**
 * Spacing scale: a linear multiplier on a rem base (Tailwind v4 pattern).
 *
 * Every named step `n` resolves to `base * multiplier(n)`. Step 0 is the
 * explicit zero token. Scaling the whole interface = changing root font-size,
 * which re-derives every step coherently — the replacement for Unit modes.
 */
export interface SpacingConfig {
  /** Base unit in rem. Step multipliers are applied to this. */
  readonly baseRem: number;
  /**
   * Named steps mapped to their multiplier of `baseRem`.
   * `0` MUST be present and MUST map to multiplier 0 (the zero token).
   */
  readonly steps: Readonly<Record<string, number>>;
  /** Semantic aliases: role name -> existing step key. Components consume these. */
  readonly aliases: Readonly<Record<string, string>>;
}

/**
 * Radii scale: a geometric rem progression plus an explicit `full` pill token
 * and an explicit zero. Same rem pattern as spacing, geometric instead of
 * linear so corners feel proportional across sizes.
 */
export interface RadiiConfig {
  /** Named steps in rem (absolute, already geometric). `0` MUST be present. */
  readonly steps: Readonly<Record<string, number>>;
  /** The pill / fully-rounded token value in px (Material 3 uses 9999). */
  readonly fullPx: number;
  /** Semantic aliases: role name -> step key (or the literal `full`). */
  readonly aliases: Readonly<Record<string, string>>;
  /**
   * Форма угла — кривизна CSS `corner-shape: superellipse(K)` поверх любого
   * радиуса (Chromium 139+; прочие браузеры игнорируют — обычный радиус).
   * Экспонента кривой n = 2^K (css-borders-4): K=1 — круг (выкл);
   * ≈2.32 — «иконная» сквирклость Apple (n≈5, K=log₂5).
   *
   * K=1.1 — DECLARED-размен, НЕ геометрический фит (деривация 2026-07-03,
   * воспроизводится: `node packages/tokens/scripts/derive-corner-k.mjs`).
   * Замер против точной кривой Figma corner smoothing ζ=0.6 (конструкция
   * figma-squircle: кубик-фланк + дуга 90(1−ζ)° + зеркальный кубик):
   *   - геометрически ближайший суперэллипс — САМ КРУГ K=1 (1.25px/R100);
   *   - K=1.1 отклоняется на 2.35px/R100 — дальше круга;
   *   - выбор K>1 оправдан ВТОРОЙ осью: кривая Figma входит в кромку с
   *     нулевой кривизной (G2), круг — со скачком 1/R (G1), суперэллипс
   *     n>2 — с κ=0 (G2). K=1.1 покупает G2-характер входа ценой 2.35px
   *     геометрии; оба отклонения суб-перцептивны в UI-масштабах.
   * CSS-ключевое `squircle` (K=2) от ζ=0.6 далеко: 18.9px/R100.
   */
  readonly cornerK: number;
}

/**
 * Размеры контролов: канонические габариты оси размера компонента
 * (`s | m | l` на компонентах), в rem. Заземлено привязками живого Figma:
 * контрол-боксы Check и Radio биндят коллекцию Size (S/M/L = 12/16/20px
 * @100%), которая сама лежит на Unit px-лестнице (px/6, px/7, px/8).
 * См. docs/dimension-contract.md §2.
 */
export interface SizesConfig {
  /** Именованные ступени в rem (абсолютные). Нулевой ступени нет: контрол нулевого размера вырожден. */
  readonly steps: Readonly<Record<string, number>>;
  /** Семантические алиасы: имя роли -> существующая ступень. Компоненты потребляют их. */
  readonly aliases: Readonly<Record<string, string>>;
}

/**
 * Z-index: a flat set of semantic levels with a fixed gap between them so a new
 * layer can be inserted without renumbering the world. No magic numbers in
 * components — they reference these names only.
 */
export interface ZIndexConfig {
  /**
   * Ordered semantic levels, lowest stacking context first. The generator
   * assigns `value = startAt + index * gap`, guaranteeing monotonic, gapped
   * integers regardless of how the list is edited.
   */
  readonly levels: readonly string[];
  /** First (lowest) z-index value. */
  readonly startAt: number;
  /** Gap between adjacent levels (reserve space for future insertions). */
  readonly gap: number;
}

/**
 * Fluid typography: a continuous gradient, NOT discrete breakpoints.
 *
 * Each step gets one `clamp(min, slope*vw + intercept, max)` where the min comes
 * from `base * ratioMin^n` and the max from `base * ratioMax^n`. Because
 * `ratioMin < ratioMax`, large steps are damped: their floor (narrow viewport)
 * is disproportionately smaller, so headings grow slower on small screens while
 * the base step is identical at both anchors. No media queries, ever. The words
 * "mobile" / "desktop" do not appear — only anchor viewports and a ratio pair.
 */
export interface TypographyConfig {
  /** Base font size in px, identical at both viewport anchors (step 0). */
  readonly basePx: number;
  /** Narrow anchor viewport in px (floor of the gradient). */
  readonly minViewportPx: number;
  /** Wide anchor viewport in px (ceiling of the gradient). */
  readonly maxViewportPx: number;
  /** Modular ratio at the narrow anchor (the damper; smaller). */
  readonly ratioMin: number;
  /** Modular ratio at the wide anchor (larger). */
  readonly ratioMax: number;
  /** Number of steps above the base (positive index). */
  readonly stepsUp: number;
  /** Number of steps below the base (negative index). */
  readonly stepsDown: number;
  /**
   * Step labels indexed by signed step number, e.g. `{ "0": "md", "7": "6xl" }`.
   * Used for human-friendly token names; any unlabeled step uses its number.
   */
  readonly stepLabels: Readonly<Record<string, string>>;
  /**
   * Интерлиньяж (line-height) — НЕ конфиг: выведен как оптический закон из
   * отпечатков Geist (`lineHeightOptical` в domain/typography.ts), а не банды.
   * Читает `basePx` (пик читаемости body) и репрезентативный кегль шага. Прежнее
   * поле `lineHeightBands` удалено — оно кодировало неверную модель (1.2/1.3/1.5).
   */
  /** rem value to use as the conversion base when emitting rem (px / remBasePx). */
  readonly remBasePx: number;
  /**
   * Font-weight scale: named role -> numeric weight (100..900). Emitted as
   * unitless `--lab-font-weight-*` tokens so weight is a per-client themeable
   * axis like every other scale, instead of a literal baked into components.
   * MUST be non-empty; each value an integer in [1, 1000].
   */
  readonly weights: Readonly<Record<string, number>>;
}

/**
 * Border / line geometry — stroke widths and the focus-ring sub-system, in rem.
 *
 * "stroke" (not "border-width") deliberately avoids the `--lab-border-*` COLOUR
 * role namespace: a stroke is a line THICKNESS, a dimension, themeable per client
 * like spacing/radii. The focus ring is its own axis (a brand may want a thicker
 * or further-offset focus indicator than its component borders).
 */
export interface BordersConfig {
  /** Named stroke widths in rem (component borders, dividers). MUST be non-empty. */
  readonly widths: Readonly<Record<string, number>>;
  /** The focus indicator: ring width and its offset from the element edge, in rem. */
  readonly focusRing: {
    readonly width: number;
    readonly offset: number;
  };
}

/** The complete LabUI token config — the single source of truth. */
export interface TokensConfig {
  readonly spacing: SpacingConfig;
  readonly sizes: SizesConfig;
  readonly radii: RadiiConfig;
  readonly zIndex: ZIndexConfig;
  readonly typography: TypographyConfig;
  readonly borders: BordersConfig;
}

/** A deep-partial of {@link TokensConfig} for user overrides. */
export type TokensConfigOverride = {
  readonly [K in keyof TokensConfig]?: Partial<TokensConfig[K]>;
};
