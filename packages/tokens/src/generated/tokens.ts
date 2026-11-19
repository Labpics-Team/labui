/**
 * LabUI dimension tokens — GENERATED. Do not edit by hand.
 *
 * Values are `var(--lab-*)` references: the live CSS custom property is the
 * source of truth at paint time, so `:root` overrides re-theme without a
 * rebuild. Import names give compile-time safety and autocomplete.
 */

/** Complete authored styles. Fluid scale steps below are a separate API. */
export const textStyle = {
  body: {
    fontFamily: 'var(--lab-font-family)',
    fontSize: 'var(--lab-text-body-font-size)',
    lineHeight: 'var(--lab-text-body-line-height)',
    fontWeight: 'var(--lab-text-body-font-weight)',
    letterSpacing: 'var(--lab-text-body-letter-spacing)',
  },
  'body-emphasized': {
    fontFamily: 'var(--lab-font-family)',
    fontSize: 'var(--lab-text-body-emphasized-font-size)',
    lineHeight: 'var(--lab-text-body-emphasized-line-height)',
    fontWeight: 'var(--lab-text-body-emphasized-font-weight)',
    letterSpacing: 'var(--lab-text-body-emphasized-letter-spacing)',
  },
  headline: {
    fontFamily: 'var(--lab-font-family)',
    fontSize: 'var(--lab-text-headline-font-size)',
    lineHeight: 'var(--lab-text-headline-line-height)',
    fontWeight: 'var(--lab-text-headline-font-weight)',
    letterSpacing: 'var(--lab-text-headline-letter-spacing)',
  },
  'caption-xs': {
    fontFamily: 'var(--lab-font-family)',
    fontSize: 'var(--lab-text-caption-xs-font-size)',
    lineHeight: 'var(--lab-text-caption-xs-line-height)',
    fontWeight: 'var(--lab-text-caption-xs-font-weight)',
    letterSpacing: 'var(--lab-text-caption-xs-letter-spacing)',
  },
} as const;

export type TextStyleRole = keyof typeof textStyle;

export const component = {
  'font-weight-button': 'var(--lab-font-weight-button)',
  'space-button-label-x': 'var(--lab-space-button-label-x)',
  'space-button-label-gap': 'var(--lab-space-button-label-gap)',
  'state-button-description-opacity': 'var(--lab-state-button-description-opacity)',
  'size-button-s': 'var(--lab-size-button-s)',
  'size-button-s-icon': 'var(--lab-size-button-s-icon)',
  'radius-button-s': 'var(--lab-radius-button-s)',
  'space-button-s-x': 'var(--lab-space-button-s-x)',
  'space-button-s-y': 'var(--lab-space-button-s-y)',
  'font-size-button-s': 'var(--lab-font-size-button-s)',
  'line-height-button-s': 'var(--lab-line-height-button-s)',
  'font-weight-button-s-description': 'var(--lab-font-weight-button-s-description)',
  'letter-spacing-button-s-description': 'var(--lab-letter-spacing-button-s-description)',
  'state-button-s-description-accent-plain-opacity': 'var(--lab-state-button-s-description-accent-plain-opacity)',
  'letter-spacing-button-s': 'var(--lab-letter-spacing-button-s)',
  'size-button-m': 'var(--lab-size-button-m)',
  'size-button-m-icon': 'var(--lab-size-button-m-icon)',
  'radius-button-m': 'var(--lab-radius-button-m)',
  'space-button-m-x': 'var(--lab-space-button-m-x)',
  'space-button-m-y': 'var(--lab-space-button-m-y)',
  'font-size-button-m': 'var(--lab-font-size-button-m)',
  'line-height-button-m': 'var(--lab-line-height-button-m)',
  'font-weight-button-m-description': 'var(--lab-font-weight-button-m-description)',
  'letter-spacing-button-m-description': 'var(--lab-letter-spacing-button-m-description)',
  'state-button-m-description-accent-plain-opacity': 'var(--lab-state-button-m-description-accent-plain-opacity)',
  'letter-spacing-button-m': 'var(--lab-letter-spacing-button-m)',
  'size-button-l': 'var(--lab-size-button-l)',
  'size-button-l-icon': 'var(--lab-size-button-l-icon)',
  'radius-button-l': 'var(--lab-radius-button-l)',
  'space-button-l-x': 'var(--lab-space-button-l-x)',
  'space-button-l-y': 'var(--lab-space-button-l-y)',
  'font-size-button-l': 'var(--lab-font-size-button-l)',
  'line-height-button-l': 'var(--lab-line-height-button-l)',
  'font-weight-button-l-description': 'var(--lab-font-weight-button-l-description)',
  'letter-spacing-button-l-description': 'var(--lab-letter-spacing-button-l-description)',
  'state-button-l-description-accent-plain-opacity': 'var(--lab-state-button-l-description-accent-plain-opacity)',
  'letter-spacing-button-l': 'var(--lab-letter-spacing-button-l)',
  'state-button-highlight': 'var(--lab-state-button-highlight)',
  'state-button-hover-highlight': 'var(--lab-state-button-hover-highlight)',
  'state-button-pressed-shade': 'var(--lab-state-button-pressed-shade)',
  'space-button-inner-x': 'var(--lab-space-button-inner-x)',
  'space-button-inner-y': 'var(--lab-space-button-inner-y)',
  'space-button-inner-blur': 'var(--lab-space-button-inner-blur)',
  'size-input-s': 'var(--lab-size-input-s)',
  'size-input-s-content': 'var(--lab-size-input-s-content)',
  'radius-input-s': 'var(--lab-radius-input-s)',
  'space-input-s-x': 'var(--lab-space-input-s-x)',
  'space-input-s-y': 'var(--lab-space-input-s-y)',
  'font-size-input-s': 'var(--lab-font-size-input-s)',
  'font-weight-input-s': 'var(--lab-font-weight-input-s)',
  'line-height-input-s': 'var(--lab-line-height-input-s)',
  'letter-spacing-input-s': 'var(--lab-letter-spacing-input-s)',
  'size-input-m': 'var(--lab-size-input-m)',
  'size-input-m-content': 'var(--lab-size-input-m-content)',
  'radius-input-m': 'var(--lab-radius-input-m)',
  'space-input-m-x': 'var(--lab-space-input-m-x)',
  'space-input-m-y': 'var(--lab-space-input-m-y)',
  'font-size-input-m': 'var(--lab-font-size-input-m)',
  'font-weight-input-m': 'var(--lab-font-weight-input-m)',
  'line-height-input-m': 'var(--lab-line-height-input-m)',
  'letter-spacing-input-m': 'var(--lab-letter-spacing-input-m)',
  'size-input-l': 'var(--lab-size-input-l)',
  'size-input-l-content': 'var(--lab-size-input-l-content)',
  'radius-input-l': 'var(--lab-radius-input-l)',
  'space-input-l-x': 'var(--lab-space-input-l-x)',
  'space-input-l-y': 'var(--lab-space-input-l-y)',
  'font-size-input-l': 'var(--lab-font-size-input-l)',
  'font-weight-input-l': 'var(--lab-font-weight-input-l)',
  'line-height-input-l': 'var(--lab-line-height-input-l)',
  'letter-spacing-input-l': 'var(--lab-letter-spacing-input-l)',
  'font-size-input-label': 'var(--lab-font-size-input-label)',
  'font-weight-input-label': 'var(--lab-font-weight-input-label)',
  'line-height-input-label': 'var(--lab-line-height-input-label)',
  'space-input-label-x': 'var(--lab-space-input-label-x)',
  'space-input-label-overhang': 'var(--lab-space-input-label-overhang)',
  'space-input-helper-gap': 'var(--lab-space-input-helper-gap)',
  'space-input-helper-x': 'var(--lab-space-input-helper-x)',
  'stroke-input': 'var(--lab-stroke-input)',
  'size-input-adornment': 'var(--lab-size-input-adornment)',
  'size-input-icon': 'var(--lab-size-input-icon)',
  'space-input-adornment-outer': 'var(--lab-space-input-adornment-outer)',
  'space-input-adornment-inner': 'var(--lab-space-input-adornment-inner)',
  'size-textarea': 'var(--lab-size-textarea)',
  'font-size-textarea-label': 'var(--lab-font-size-textarea-label)',
  'line-height-textarea-label': 'var(--lab-line-height-textarea-label)',
  'space-textarea-top': 'var(--lab-space-textarea-top)',
  'space-textarea-bottom': 'var(--lab-space-textarea-bottom)',
  'space-textarea-start': 'var(--lab-space-textarea-start)',
  'space-textarea-end': 'var(--lab-space-textarea-end)',
  'radius-card-surface': 'var(--lab-radius-card-surface)',
  'space-card-padding': 'var(--lab-space-card-padding)',
  'space-card-gap': 'var(--lab-space-card-gap)',
  'shape-card-smoothing': 'var(--lab-shape-card-smoothing)',
  'stroke-card': 'var(--lab-stroke-card)',
  'size-card-media': 'var(--lab-size-card-media)',
  'space-card-caption-gap': 'var(--lab-space-card-caption-gap)',
  'space-card-text-gap': 'var(--lab-space-card-text-gap)',
  'space-card-title-gap': 'var(--lab-space-card-title-gap)',
  'font-size-card-title': 'var(--lab-font-size-card-title)',
  'line-height-card-title': 'var(--lab-line-height-card-title)',
  'font-weight-card-title': 'var(--lab-font-weight-card-title)',
  'letter-spacing-card-title': 'var(--lab-letter-spacing-card-title)',
  'font-size-card-description': 'var(--lab-font-size-card-description)',
  'line-height-card-description': 'var(--lab-line-height-card-description)',
  'font-weight-card-description': 'var(--lab-font-weight-card-description)',
  'letter-spacing-card-description': 'var(--lab-letter-spacing-card-description)',
  'font-size-card-caption': 'var(--lab-font-size-card-caption)',
  'line-height-card-caption': 'var(--lab-line-height-card-caption)',
  'font-weight-card-caption': 'var(--lab-font-weight-card-caption)',
  'letter-spacing-card-caption': 'var(--lab-letter-spacing-card-caption)',
  'font-size-sheet-title': 'var(--lab-font-size-sheet-title)',
  'line-height-sheet-title': 'var(--lab-line-height-sheet-title)',
  'font-weight-sheet-title': 'var(--lab-font-weight-sheet-title)',
  'letter-spacing-sheet-title': 'var(--lab-letter-spacing-sheet-title)',
  'font-size-sheet-description': 'var(--lab-font-size-sheet-description)',
  'line-height-sheet-description': 'var(--lab-line-height-sheet-description)',
  'font-weight-sheet-description': 'var(--lab-font-weight-sheet-description)',
  'letter-spacing-sheet-description': 'var(--lab-letter-spacing-sheet-description)',
  'radius-sheet-top': 'var(--lab-radius-sheet-top)',
  'space-sheet-x': 'var(--lab-space-sheet-x)',
  'space-sheet-bottom': 'var(--lab-space-sheet-bottom)',
  'space-sheet-content-gap': 'var(--lab-space-sheet-content-gap)',
  'space-sheet-header-gap': 'var(--lab-space-sheet-header-gap)',
  'size-sheet-drag-area': 'var(--lab-size-sheet-drag-area)',
  'size-sheet-drag-width': 'var(--lab-size-sheet-drag-width)',
  'size-sheet-drag-height': 'var(--lab-size-sheet-drag-height)',
  'radius-sheet-drag': 'var(--lab-radius-sheet-drag)',
  'space-sheet-drag-top': 'var(--lab-space-sheet-drag-top)',
  'space-sheet-drag-center-offset': 'var(--lab-space-sheet-drag-center-offset)',
  'size-sheet-body-full': 'var(--lab-size-sheet-body-full)',
  'size-sheet-body-two-thirds': 'var(--lab-size-sheet-body-two-thirds)',
  'size-sheet-body-one-third': 'var(--lab-size-sheet-body-one-third)',
  'radius-snackbar': 'var(--lab-radius-snackbar)',
  'space-snackbar-start': 'var(--lab-space-snackbar-start)',
  'space-snackbar-end': 'var(--lab-space-snackbar-end)',
  'space-snackbar-y': 'var(--lab-space-snackbar-y)',
  'space-snackbar-action-gap': 'var(--lab-space-snackbar-action-gap)',
  'space-snackbar-label-gap': 'var(--lab-space-snackbar-label-gap)',
  'font-size-snackbar': 'var(--lab-font-size-snackbar)',
  'font-weight-snackbar': 'var(--lab-font-weight-snackbar)',
  'line-height-snackbar': 'var(--lab-line-height-snackbar)',
  'stroke-snackbar': 'var(--lab-stroke-snackbar)',
  'size-snackbar-timer': 'var(--lab-size-snackbar-timer)',
  'size-badge': 'var(--lab-size-badge)',
  'size-badge-icon': 'var(--lab-size-badge-icon)',
  'radius-badge': 'var(--lab-radius-badge)',
  'space-badge-x': 'var(--lab-space-badge-x)',
  'space-badge-y': 'var(--lab-space-badge-y)',
  'space-badge-gap': 'var(--lab-space-badge-gap)',
  'font-size-badge': 'var(--lab-font-size-badge)',
  'font-weight-badge': 'var(--lab-font-weight-badge)',
  'line-height-badge': 'var(--lab-line-height-badge)',
  'letter-spacing-badge': 'var(--lab-letter-spacing-badge)',
} as const;

export type ComponentToken = keyof typeof component;

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
  'glow-core': 'var(--lab-space-glow-core)',
  'glow-halo': 'var(--lab-space-glow-halo)',
} as const;

export type SpaceToken = keyof typeof space;

export const size = {
  'control-s': 'var(--lab-size-control-s)',
  'control-m': 'var(--lab-size-control-m)',
  'control-l': 'var(--lab-size-control-l)',
  'control-xl': 'var(--lab-size-control-xl)',
  'switch-track-s': 'var(--lab-size-switch-track-s)',
  'switch-track-m': 'var(--lab-size-switch-track-m)',
  'switch-track-l': 'var(--lab-size-switch-track-l)',
  'switch-track-h-s': 'var(--lab-size-switch-track-h-s)',
  'switch-track-h-m': 'var(--lab-size-switch-track-h-m)',
  'switch-track-h-l': 'var(--lab-size-switch-track-h-l)',
  'switch-thumb-s': 'var(--lab-size-switch-thumb-s)',
  'switch-thumb-m': 'var(--lab-size-switch-thumb-m)',
  'switch-thumb-l': 'var(--lab-size-switch-thumb-l)',
  'loader-stroke-s': 'var(--lab-size-loader-stroke-s)',
  'loader-stroke-m': 'var(--lab-size-loader-stroke-m)',
  'loader-stroke-l': 'var(--lab-size-loader-stroke-l)',
  'checkbox-tiny': 'var(--lab-size-checkbox-tiny)',
  'avatar-s': 'var(--lab-size-avatar-s)',
  'avatar-m': 'var(--lab-size-avatar-m)',
  'avatar-l': 'var(--lab-size-avatar-l)',
  'avatar-dot-s': 'var(--lab-size-avatar-dot-s)',
  'avatar-dot-m': 'var(--lab-size-avatar-dot-m)',
  'avatar-dot-l': 'var(--lab-size-avatar-dot-l)',
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
  xxs: 'var(--lab-radius-xxs)',
  xs: 'var(--lab-radius-xs)',
  s: 'var(--lab-radius-s)',
  m: 'var(--lab-radius-m)',
  l: 'var(--lab-radius-l)',
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

export const opacity = {
  '0': 'var(--lab-opacity-0)',
  '45': 'var(--lab-opacity-45)',
  '50': 'var(--lab-opacity-50)',
  '100': 'var(--lab-opacity-100)',
  none: 'var(--lab-opacity-none)',
  disabled: 'var(--lab-opacity-disabled)',
  muted: 'var(--lab-opacity-muted)',
  full: 'var(--lab-opacity-full)',
} as const;

export type OpacityToken = keyof typeof opacity;
