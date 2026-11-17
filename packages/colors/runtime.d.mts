import type init from '@labpics/colors';

export type Theme = 'light' | 'dark';
export type Contrast = 'normal' | 'more';
export type Background = readonly [number, number, number];
export interface ThemeInput {
  theme?: Theme;
  contrast?: Contrast;
  /** Actual known sRGB8 backgrounds. Never infer them from a video or blur. */
  backgrounds?: readonly Background[];
}
export interface ThemeState {
  readonly theme: Theme;
  readonly contrast: Contrast;
  readonly backgrounds: readonly Background[];
}
export type ThemeUpdate =
  | { ok: true; state: ThemeState }
  | { ok: false; error: unknown; state: ThemeState | null };
export interface ThemeScope {
  readonly state: ThemeState | null;
  update(input?: ThemeInput): ThemeUpdate;
  dispose(): void;
}
export class ThemeUpdateError extends Error {
  readonly code: string;
  constructor(code: string, message: string);
}
export function initializeColors(input?: Parameters<typeof init>[0]): ReturnType<typeof init>;
export function createThemeScope(
  root: HTMLElement | SVGElement,
  options?: { onError?: (error: unknown) => void },
): ThemeScope;
