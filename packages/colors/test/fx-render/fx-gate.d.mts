// Типы разделяемого FX-render гейта (реализация — fx-gate.mjs). Нужны, чтобы
// apps/docs playwright-спека (TS, allowJs:false) резолвила импорт под strict.

export const SENTIMENTS: readonly string[];
export const GLOW_STEPS: readonly string[];
export const SKELETON_LAYERS: readonly string[];

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Sample {
  r: number;
  g: number;
  b: number;
  L: number;
  n: number;
}

export interface DecodedPng {
  width: number;
  height: number;
  rgb: Uint8Array;
}

export interface Measurements {
  backdropL: number;
  glow: Record<string, { subtle: Sample; base: Sample; bloom: Sample }>;
  focus: Record<string, Sample>;
  skeleton: { base: Sample; highlight: Sample };
}

/** Опции харнесса: bite-мутации glow/focus/skeleton (override-слой). */
export interface HarnessOpts {
  flatten?: boolean;
  dropGlow?: string | null;
  dropFocus?: string | null;
  skeletonBite?: 'flatten' | 'invert' | null;
}

export function buildHarnessHtml(contractCss: string, opts?: HarnessOpts): string;

export function decodePng(buf: Buffer | Uint8Array): DecodedPng;

export function sampleRegion(png: DecodedPng, bbox: BBox): Sample;

export function assertFxRender(m: Measurements): {
  deltas: Record<string, { subtle: number; base: number; bloom: number }>;
  focus: Record<string, Sample>;
  skeleton: { base: Sample; highlight: Sample };
};

export function renderAndMeasure(
  chromium: unknown,
  contractCss: string,
  opts?: HarnessOpts,
): Promise<{ png: Buffer; measurements: Measurements }>;
