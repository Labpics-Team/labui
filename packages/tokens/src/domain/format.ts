/**
 * Deterministic number formatting for token values.
 *
 * Floating-point arithmetic (e.g. `0.1 + 0.2`, `16 * 1.333 ** 7`) leaves noise
 * that would make generated artifacts non-idempotent across runs. Every value
 * is rounded to a fixed precision and stripped of trailing zeros so the same
 * config always produces byte-identical output.
 */

/** Round to `precision` decimals, killing floating-point drift. */
export function round(value: number, precision = 4): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Cannot format non-finite number: ${value}`);
  }
  const factor = 10 ** precision;
  // +0 normalizes -0 to 0 so the zero token never emits "-0rem".
  return Math.round(value * factor) / factor + 0;
}

/** Format a number as a trimmed decimal string, e.g. `1.5`, `0`, `0.0625`. */
export function num(value: number, precision = 4): string {
  return String(round(value, precision));
}

/** Format a rem dimension, e.g. `1rem`, `0rem`, `0.0625rem`. */
export function rem(value: number, precision = 4): string {
  return `${num(value, precision)}rem`;
}

/** Format a px dimension, e.g. `16px`, `0px`. */
export function px(value: number, precision = 4): string {
  return `${num(value, precision)}px`;
}

/** Convert px to rem against a base (default 16px root). */
export function pxToRem(pxValue: number, basePx = 16): number {
  return pxValue / basePx;
}
