export interface LabuiPaintInput {
  source: string;
  opacity: number;
}
export interface LabuiPreparedTheme {
  paints: Map<string, LabuiPaintInput>;
  composites: Map<string, LabuiPaintInput>;
  aliases: Map<string, string>;
  constraints: Array<{ foreground: string; background: string; criterion: 'text' | 'ui' }>;
  pending: string[];
  background: string;
  tone: { source: string; alpha: [number, number] };
}
export interface LabuiPreparedConfig {
  sources: Record<string, [number, number, number]>;
  themes: Record<'light' | 'dark', LabuiPreparedTheme>;
  observation: {
    adaptingLuminance: number;
    backgroundRatio: number;
    surround: 'average' | 'dim' | 'dark';
  };
  policy: {
    contrast: 'unresolved' | 'authored-normal' | 'strict';
    assignment: 'preserve-authored';
  };
}
/** Проверяет JSON и разворачивает роли без вычисления цветов. Имена Map без --lab-. */
export function prepareEngineConfig(parsed: unknown): LabuiPreparedConfig;
