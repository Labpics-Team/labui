/**
 * Domain model for a resolved token.
 *
 * A {@link ResolvedToken} is the canonical, framework-free representation a
 * single token, produced by the scale builders and consumed by every generator
 * (CSS / TS / DTCG). It carries enough metadata to emit all three without any
 * generator needing to re-derive values.
 */

/** The scale a token belongs to — drives its CSS prefix and DTCG group. */
export type ScaleKind =
  | 'space'
  | 'radius'
  | 'z'
  | 'font-size'
  | 'font-weight'
  | 'line-height'
  | 'tracking'
  | 'stroke'
  | 'focus-ring';

/**
 * A fully resolved token.
 *
 * `cssValue` is the exact string emitted into the stylesheet (already formatted,
 * e.g. `"1rem"`, `"clamp(...)"`, `"800"`). `numeric` is the canonical magnitude
 * for tests and DTCG (px for dimensions, the integer for z-index). For fluid
 * font sizes, `numeric` is undefined — a fluid step has no single number — and
 * the clamp bounds live in `fluid` instead.
 */
export interface ResolvedToken {
  readonly kind: ScaleKind;
  /** Step / role key, e.g. `"0"`, `"md"`, `"modal"`, `"6xl"`. */
  readonly name: string;
  /** The CSS custom-property value string. */
  readonly cssValue: string;
  /** Canonical numeric magnitude (px for dimensions, int for z), if scalar. */
  readonly numeric?: number;
  /** DTCG `$type` for this token. */
  readonly dtcgType: 'dimension' | 'number';
  /** Present for fluid typography steps — the clamp anchors. */
  readonly fluid?: FluidBounds;
  /** Optional human description (e.g. z-index layer purpose). */
  readonly description?: string;
}

/** Clamp anchor metadata for a fluid typography step. */
export interface FluidBounds {
  /** Signed step index (0 = base). */
  readonly step: number;
  /** Minimum size in px (narrow-viewport floor). */
  readonly minPx: number;
  /** Maximum size in px (wide-viewport ceiling). */
  readonly maxPx: number;
  /** Linear preferred-value slope, in vw units (already × 100). */
  readonly slopeVw: number;
  /** Linear preferred-value intercept, in rem. */
  readonly interceptRem: number;
}

/** A semantic alias: a role name that points at a primitive token. */
export interface ResolvedAlias {
  readonly kind: ScaleKind;
  /** Role name, e.g. `"control"`, `"card"`, `"md"`. */
  readonly name: string;
  /** The primitive token name it resolves to. */
  readonly target: string;
  /** The resolved CSS value (a `var(--lab-...)` reference). */
  readonly cssValue: string;
}
