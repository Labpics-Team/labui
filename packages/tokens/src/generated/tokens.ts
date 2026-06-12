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
  none: 'var(--lab-radius-none)',
  control: 'var(--lab-radius-control)',
  card: 'var(--lab-radius-card)',
  pill: 'var(--lab-radius-pill)',
  circle: 'var(--lab-radius-circle)',
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
