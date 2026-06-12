/**
 * LabUI token configuration — the single source of truth.
 *
 * One typed config describes every dimension scale declaratively. The generator
 * (see `../generate`) turns this into three artifacts without divergence: CSS
 * custom properties (`--lab-*`), a typed TS module, and a canonical DTCG export.
 *
 * Design rules encoded here (from the epic's cross-cutting principles):
 *  - Everything is rem-relative; interface scaling is root font-size, never the
 *    dead Unit 75-133% modes.
 *  - Every scale carries an explicit, correct zero token.
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
   * Line-height multiplier as a function of step. Larger steps (display) get a
   * tighter ratio (~1.2), body/label looser (~1.5) per Material 3. Expressed as
   * thresholds: the first entry whose `fromStep <= step` wins, evaluated from
   * the highest threshold down.
   */
  readonly lineHeightBands: readonly LineHeightBand[];
  /** rem value to use as the conversion base when emitting rem (px / remBasePx). */
  readonly remBasePx: number;
}

/** A line-height band: steps at or above `fromStep` use `multiplier`. */
export interface LineHeightBand {
  readonly fromStep: number;
  readonly multiplier: number;
}

/** The complete LabUI token config — the single source of truth. */
export interface TokensConfig {
  readonly spacing: SpacingConfig;
  readonly radii: RadiiConfig;
  readonly zIndex: ZIndexConfig;
  readonly typography: TypographyConfig;
}

/** A deep-partial of {@link TokensConfig} for user overrides. */
export type TokensConfigOverride = {
  readonly [K in keyof TokensConfig]?: Partial<TokensConfig[K]>;
};
