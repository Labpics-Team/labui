/**
 * LabUI dimension tokens — GENERATED. Do not edit by hand.
 *
 * Values are `var(--lab-*)` references: the live CSS custom property is the
 * source of truth at paint time, so `:root` overrides re-theme without a
 * rebuild. Import names give compile-time safety and autocomplete.
 */

export const space = {
  '0': 'var(--lab-space-0)',
  '1': 'var(--lab-space-1)',
  '2': 'var(--lab-space-2)',
  '3': 'var(--lab-space-3)',
  '4': 'var(--lab-space-4)',
  '5': 'var(--lab-space-5)',
  '6': 'var(--lab-space-6)',
  '7': 'var(--lab-space-7)',
  '8': 'var(--lab-space-8)',
  '9': 'var(--lab-space-9)',
  '10': 'var(--lab-space-10)',
  '11': 'var(--lab-space-11)',
  '12': 'var(--lab-space-12)',
  '14': 'var(--lab-space-14)',
  '16': 'var(--lab-space-16)',
  '18': 'var(--lab-space-18)',
  '20': 'var(--lab-space-20)',
  '22': 'var(--lab-space-22)',
  '24': 'var(--lab-space-24)',
  '26': 'var(--lab-space-26)',
  '28': 'var(--lab-space-28)',
  '30': 'var(--lab-space-30)',
  '32': 'var(--lab-space-32)',
  none: 'var(--lab-space-none)',
  xs: 'var(--lab-space-xs)',
  sm: 'var(--lab-space-sm)',
  md: 'var(--lab-space-md)',
  lg: 'var(--lab-space-lg)',
  xl: 'var(--lab-space-xl)',
  '2xl': 'var(--lab-space-2xl)',
  '3xl': 'var(--lab-space-3xl)',
} as const;

export type SpaceToken = keyof typeof space;

export const size = {
  'control-s': 'var(--lab-size-control-s)',
  'control-m': 'var(--lab-size-control-m)',
  'control-l': 'var(--lab-size-control-l)',
  'control-xl': 'var(--lab-size-control-xl)',
  'control-h-s': 'var(--lab-size-control-h-s)',
  'control-h-m': 'var(--lab-size-control-h-m)',
  'control-h-l': 'var(--lab-size-control-h-l)',
  'overlay-11': 'var(--lab-size-overlay-11)',
  'overlay-12': 'var(--lab-size-overlay-12)',
  'overlay-14': 'var(--lab-size-overlay-14)',
  'overlay-16': 'var(--lab-size-overlay-16)',
  'overlay-18': 'var(--lab-size-overlay-18)',
  'overlay-20': 'var(--lab-size-overlay-20)',
  'overlay-22': 'var(--lab-size-overlay-22)',
  'overlay-24': 'var(--lab-size-overlay-24)',
  'overlay-28': 'var(--lab-size-overlay-28)',
  'overlay-32': 'var(--lab-size-overlay-32)',
  'overlay-40': 'var(--lab-size-overlay-40)',
} as const;

export type SizeToken = keyof typeof size;

export const radius = {
  '0': 'var(--lab-radius-0)',
  xs: 'var(--lab-radius-xs)',
  sm: 'var(--lab-radius-sm)',
  md: 'var(--lab-radius-md)',
  lg: 'var(--lab-radius-lg)',
  xl: 'var(--lab-radius-xl)',
  '2xl': 'var(--lab-radius-2xl)',
  '3xl': 'var(--lab-radius-3xl)',
  '4xl': 'var(--lab-radius-4xl)',
  '5xl': 'var(--lab-radius-5xl)',
  full: 'var(--lab-radius-full)',
  'corner-k': 'var(--lab-radius-corner-k)',
  none: 'var(--lab-radius-none)',
  control: 'var(--lab-radius-control)',
  card: 'var(--lab-radius-card)',
  pill: 'var(--lab-radius-pill)',
  circle: 'var(--lab-radius-circle)',
  'concentric-min': 'var(--lab-radius-concentric-min)',
} as const;

export type RadiusToken = keyof typeof radius;

export const zIndex = {
  primary: 'var(--lab-z-primary)',
  secondary: 'var(--lab-z-secondary)',
  tertiary: 'var(--lab-z-tertiary)',
  quaternary: 'var(--lab-z-quaternary)',
  'grouped-primary': 'var(--lab-z-grouped-primary)',
  'grouped-secondary': 'var(--lab-z-grouped-secondary)',
  'grouped-tertiary': 'var(--lab-z-grouped-tertiary)',
  inverted: 'var(--lab-z-inverted)',
  'skip-link': 'var(--lab-z-skip-link)',
  dropdown: 'var(--lab-z-dropdown)',
  sticky: 'var(--lab-z-sticky)',
  'modal-underlay': 'var(--lab-z-modal-underlay)',
  modal: 'var(--lab-z-modal)',
  toast: 'var(--lab-z-toast)',
  tooltip: 'var(--lab-z-tooltip)',
} as const;

export type ZIndexToken = keyof typeof zIndex;

export const fontSize = {
  xxs: 'var(--lab-font-size-xxs)',
  xs: 'var(--lab-font-size-xs)',
  md: 'var(--lab-font-size-md)',
  lg: 'var(--lab-font-size-lg)',
  xl: 'var(--lab-font-size-xl)',
  '2xl': 'var(--lab-font-size-2xl)',
  '3xl': 'var(--lab-font-size-3xl)',
  '4xl': 'var(--lab-font-size-4xl)',
  '5xl': 'var(--lab-font-size-5xl)',
  '6xl': 'var(--lab-font-size-6xl)',
} as const;

export type FontSizeToken = keyof typeof fontSize;

export const lineHeight = {
  xxs: 'var(--lab-line-height-xxs)',
  xs: 'var(--lab-line-height-xs)',
  md: 'var(--lab-line-height-md)',
  lg: 'var(--lab-line-height-lg)',
  xl: 'var(--lab-line-height-xl)',
  '2xl': 'var(--lab-line-height-2xl)',
  '3xl': 'var(--lab-line-height-3xl)',
  '4xl': 'var(--lab-line-height-4xl)',
  '5xl': 'var(--lab-line-height-5xl)',
  '6xl': 'var(--lab-line-height-6xl)',
} as const;

export type LineHeightToken = keyof typeof lineHeight;

export const fontWeight = {
  regular: 'var(--lab-font-weight-regular)',
  medium: 'var(--lab-font-weight-medium)',
  semibold: 'var(--lab-font-weight-semibold)',
  bold: 'var(--lab-font-weight-bold)',
} as const;

export type FontWeightToken = keyof typeof fontWeight;

export const letterSpacing = {
  xxs: 'var(--lab-letter-spacing-xxs)',
  xs: 'var(--lab-letter-spacing-xs)',
  md: 'var(--lab-letter-spacing-md)',
  lg: 'var(--lab-letter-spacing-lg)',
  xl: 'var(--lab-letter-spacing-xl)',
  '2xl': 'var(--lab-letter-spacing-2xl)',
  '3xl': 'var(--lab-letter-spacing-3xl)',
  '4xl': 'var(--lab-letter-spacing-4xl)',
  '5xl': 'var(--lab-letter-spacing-5xl)',
  '6xl': 'var(--lab-letter-spacing-6xl)',
} as const;

export type LetterSpacingToken = keyof typeof letterSpacing;

export const measure = {
  narrow: 'var(--lab-measure-narrow)',
  base: 'var(--lab-measure-base)',
  wide: 'var(--lab-measure-wide)',
} as const;

export type MeasureToken = keyof typeof measure;

export const font = {
  family: 'var(--lab-font-family)',
  'family-mono': 'var(--lab-font-family-mono)',
  'feature-tabular': 'var(--lab-font-feature-tabular)',
  'feature-fractions': 'var(--lab-font-feature-fractions)',
} as const;

export type FontToken = keyof typeof font;

export const stroke = {
  hairline: 'var(--lab-stroke-hairline)',
  thick: 'var(--lab-stroke-thick)',
} as const;

export type StrokeToken = keyof typeof stroke;

export const focusRing = {
  width: 'var(--lab-focus-ring-width)',
  offset: 'var(--lab-focus-ring-offset)',
} as const;

export type FocusRingToken = keyof typeof focusRing;

export const state = {
  hover: 'var(--lab-state-hover)',
  pressed: 'var(--lab-state-pressed)',
} as const;

export type StateToken = keyof typeof state;
