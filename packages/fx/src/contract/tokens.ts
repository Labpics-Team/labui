/**
 * CSS custom property contract for the effects system.
 *
 * These tokens are READ by the API layer at dispatch time and WRITTEN by
 * the colour core (@labpics/colors) + theme config. The engine never
 * hardcodes a value — it always reads the live computed style from :root.
 *
 * Naming convention follows the existing `--lab-*` pattern from
 * the `@labpics/colors` CSS contract and `@labpics/ui-shadow`.
 */

export const FX_TOKEN_NAMES = {
  glassIor: '--lab-glass-ior',
  glassDepth: '--lab-glass-depth',
  glassFresnel: '--lab-glass-fresnel-power',
  glassTint: '--lab-glass-tint',
  glassChromatic: '--lab-glass-chromatic-aberration',
  blurFrom: '--lab-blur-from',
  blurTo: '--lab-blur-to',
  blurCurve: '--lab-blur-curve',
  blurAxis: '--lab-blur-axis',
  shadowDepth: '--lab-shadow-depth',
  shadowLightAngle: '--lab-light-angle',
  shadowPenumbraScale: '--lab-shadow-penumbra-scale',
  surfaceShadowTint: '--lab-surface-shadow-tint',
} as const;

export type FxTokenName = (typeof FX_TOKEN_NAMES)[keyof typeof FX_TOKEN_NAMES];

export interface FxTokenValues {
  glassIor: number;
  glassDepth: number;
  glassFresnel: number;
  glassTint: [number, number, number];
  glassChromatic: number;
  blurFrom: number;
  blurTo: number;
  blurCurve: 'linear' | 'ease-out' | 'ease-in-out';
  blurAxis: 'x' | 'y';
  shadowDepth: number;
  shadowLightAngle: number;
  shadowPenumbraScale: number;
  surfaceShadowTint: [number, number, number];
}

const TOKEN_DEFAULTS: FxTokenValues = {
  glassIor: 1.33,
  glassDepth: 1,
  glassFresnel: 5,
  glassTint: [1, 1, 1],
  glassChromatic: 0.3,
  blurFrom: 0,
  blurTo: 24,
  blurCurve: 'ease-out',
  blurAxis: 'y',
  shadowDepth: 1,
  shadowLightAngle: 35,
  shadowPenumbraScale: 0.5,
  surfaceShadowTint: [0, 0, 0],
};

function readNumeric(styles: CSSStyleDeclaration, name: string, fallback: number): number {
  const raw = styles.getPropertyValue(name).trim();
  if (!raw) return fallback;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}

function readColourTriplet(
  styles: CSSStyleDeclaration,
  name: string,
  fallback: [number, number, number],
): [number, number, number] {
  const raw = styles.getPropertyValue(name).trim();
  if (!raw) return fallback;

  // Support `#rrggbb` hex — the most common token format.
  if (raw.startsWith('#') && raw.length === 7) {
    const r = Number.parseInt(raw.slice(1, 3), 16) / 255;
    const g = Number.parseInt(raw.slice(3, 5), 16) / 255;
    const b = Number.parseInt(raw.slice(5, 7), 16) / 255;
    if ([r, g, b].every((c) => Number.isFinite(c))) return [r, g, b];
  }

  // Support `rgb(r g b)` or `rgb(r, g, b)` — strip non-numeric cruft.
  const numbers = raw
    .replace(/[^0-9.\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(Number);
  if (numbers.length >= 3) {
    const [r, g, b] = numbers as [number, number, number];
    if ([r, g, b].every((c) => Number.isFinite(c))) return [r / 255, g / 255, b / 255];
  }

  return fallback;
}

function readCurve(raw: string): 'linear' | 'ease-out' | 'ease-in-out' {
  switch (raw.trim()) {
    case 'linear':
      return 'linear';
    case 'ease-in-out':
      return 'ease-in-out';
    default:
      return 'ease-out';
  }
}

function readAxis(raw: string): 'x' | 'y' {
  return raw.trim() === 'x' ? 'x' : 'y';
}

/**
 * Read current FX token values from `:root` computed styles.
 *
 * Called once per config change (rarely — tokens are static for a theme).
 * The engine resolves tokens at the document root; per-element overrides
 * are not supported in v0 because the effects system is a full-page
 * compositor that samples tokens from one source of truth.
 *
 * SSR-safe: returns defaults when `document` is unavailable.
 */
export function readFxCssTokens(): FxTokenValues {
  if (typeof document === 'undefined') return { ...TOKEN_DEFAULTS };

  const styles = getComputedStyle(document.documentElement);

  return {
    glassIor: readNumeric(styles, FX_TOKEN_NAMES.glassIor, TOKEN_DEFAULTS.glassIor),
    glassDepth: readNumeric(styles, FX_TOKEN_NAMES.glassDepth, TOKEN_DEFAULTS.glassDepth),
    glassFresnel: readNumeric(styles, FX_TOKEN_NAMES.glassFresnel, TOKEN_DEFAULTS.glassFresnel),
    glassTint: readColourTriplet(styles, FX_TOKEN_NAMES.glassTint, TOKEN_DEFAULTS.glassTint),
    glassChromatic: readNumeric(
      styles,
      FX_TOKEN_NAMES.glassChromatic,
      TOKEN_DEFAULTS.glassChromatic,
    ),
    blurFrom: readNumeric(styles, FX_TOKEN_NAMES.blurFrom, TOKEN_DEFAULTS.blurFrom),
    blurTo: readNumeric(styles, FX_TOKEN_NAMES.blurTo, TOKEN_DEFAULTS.blurTo),
    blurCurve: readCurve(styles.getPropertyValue(FX_TOKEN_NAMES.blurCurve)),
    blurAxis: readAxis(styles.getPropertyValue(FX_TOKEN_NAMES.blurAxis)),
    shadowDepth: readNumeric(styles, FX_TOKEN_NAMES.shadowDepth, TOKEN_DEFAULTS.shadowDepth),
    shadowLightAngle: readNumeric(
      styles,
      FX_TOKEN_NAMES.shadowLightAngle,
      TOKEN_DEFAULTS.shadowLightAngle,
    ),
    shadowPenumbraScale: readNumeric(
      styles,
      FX_TOKEN_NAMES.shadowPenumbraScale,
      TOKEN_DEFAULTS.shadowPenumbraScale,
    ),
    surfaceShadowTint: readColourTriplet(
      styles,
      FX_TOKEN_NAMES.surfaceShadowTint,
      TOKEN_DEFAULTS.surfaceShadowTint,
    ),
  };
}
