/**
 * Типы деривации cornerK (derive-corner-k.mjs) — для тест-замка
 * corner-k.test.ts. Скрипт остаётся zero-dep CLI; типы — сбоку.
 */
export declare const R: number;
export declare const ZETA: number;
export declare const EDGE_EXTENT: number;
export declare function figmaCornerPoints(
  radius: number,
  zeta: number,
  samplesPerSegment?: number,
): Array<[number, number]>;
export declare function superellipsePoints(
  radius: number,
  n: number,
  edgeExtent: number,
  samples?: number,
): Array<[number, number]>;
export declare function maxDeviation(
  a: Array<[number, number]>,
  b: Array<[number, number]>,
): number;
export declare function deviationForN(n: number): number;
export declare function fitOptimalN(): number;
