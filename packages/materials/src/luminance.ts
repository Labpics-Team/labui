/*
 * Pure sRGB colour math — WCAG relative luminance, contrast ratio, and
 * straight-alpha compositing. Zero dependencies, zero DOM: this is the domain
 * layer the material guarantee is built on (Clean Architecture — the innermost
 * ring knows nothing about CSS, the contract file, or the browser).
 *
 * Everything here follows WCAG 2.1 relative-luminance definitions verbatim so
 * the guarantee is a real accessibility floor, not a bespoke heuristic.
 */

/** An sRGB colour with straight (non-premultiplied) alpha. Channels 0..255, alpha 0..1. */
export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

const SRGB_MAX = 255;

/**
 * Parse a modern `rgb(r g b)` / `rgb(r g b / a)` or legacy `rgb(r,g,b,a)`
 * colour string into an {@link Rgba}. Percentages are honoured. Returns `null`
 * for any other colour form (e.g. `oklch(…)`, hex) — the caller decides what a
 * non-rgb input means rather than this function guessing.
 */
export function parseRgb(input: string): Rgba | null {
  const match = input.trim().match(/^rgba?\(([^)]+)\)$/i);
  const body = match?.[1];
  if (body === undefined) {
    return null;
  }
  const parts = body.split(/[\s,/]+/).filter((part) => part.length > 0);
  if (parts.length < 3) {
    return null;
  }
  const channel = (raw: string): number =>
    raw.endsWith('%') ? (Number.parseFloat(raw) / 100) * SRGB_MAX : Number.parseFloat(raw);

  const [rawR, rawG, rawB, rawA] = parts;
  const r = channel(rawR ?? '');
  const g = channel(rawG ?? '');
  const b = channel(rawB ?? '');
  const a =
    rawA === undefined
      ? 1
      : rawA.endsWith('%')
        ? Number.parseFloat(rawA) / 100
        : Number.parseFloat(rawA);
  if ([r, g, b, a].some((value) => Number.isNaN(value))) {
    return null;
  }
  return { r, g, b, a };
}

/** Linearise one 0..255 sRGB channel to light-linear space (WCAG 2.1). */
function linearise(channel: number): number {
  const s = channel / SRGB_MAX;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.1 relative luminance of a colour (its alpha is ignored — luminance is a property of the colour itself). */
export function relativeLuminance(colour: Rgba): number {
  return 0.2126 * linearise(colour.r) + 0.7152 * linearise(colour.g) + 0.0722 * linearise(colour.b);
}

/** WCAG contrast ratio between two luminances (order-independent), 1..21. */
export function contrastRatio(l1: number, l2: number): number {
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Composite a straight-alpha source over a fully-opaque backdrop, returning the
 * opaque result. This is the "solid canon" of a two-layer material fill: the
 * translucent `01` tint painted over the opaque `02` base.
 */
export function compositeOver(source: Rgba, base: Rgba): Rgba {
  const a = source.a;
  return {
    r: source.r * a + base.r * (1 - a),
    g: source.g * a + base.g * (1 - a),
    b: source.b * a + base.b * (1 - a),
    a: 1,
  };
}
