import type { Background, Contrast, Theme } from './runtime.mjs';

export interface PreparedThemeProgram {
  /** Colors Program wire ABI v2. Each call returns its own byte buffer. */
  readonly bytes: Uint8Array;
  readonly outputs: readonly Readonly<{ slot: number; name: string }>[];
  /** Aliases begin with @; numbers are non-colour profile values. */
  readonly roles: Readonly<Record<string, string | number>>;
  readonly background: Background;
  readonly theme: Theme;
  readonly contrast: Contrast;
}

/** Build-time input shared by JS and native. No WASM initialization is required. */
export function prepareThemeProgram(theme?: Theme, contrast?: Contrast): PreparedThemeProgram;
