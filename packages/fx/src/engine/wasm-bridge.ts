/**
 * Thin bridge over Rust WASM. All CPU computation routes through here.
 *
 * The computation engine lives in crates/fx-core + crates/fx-wasm
 * (compiled to .wasm by wasm-pack). This module provides the JS/TS
 * interface to that WASM module with a lazy initialisation pattern:
 * a throwing stub until initFxWasm() wires the real functions.
 */

export interface WasmFx {
  generateRadiusMap(
    width: number,
    height: number,
    from: number,
    to: number,
    curve: Curve,
    axis: Axis,
  ): Float32Array;
  computePenumbra(
    mask: Uint8Array,
    width: number,
    height: number,
    lightAngleDeg: number,
    depth: number,
    penumbraScale: number,
  ): Float32Array;
  proxyDim(native: number): number;
}

type Curve = 'linear' | 'ease-out' | 'ease-in-out';
type Axis = 'x' | 'y';

// Stub that throws — replaced after WASM init.
let wasm: WasmFx = {
  generateRadiusMap: (): Float32Array => {
    throw new Error('WASM not loaded — call initFxWasm() first');
  },
  computePenumbra: (): Float32Array => {
    throw new Error('WASM not loaded — call initFxWasm() first');
  },
  proxyDim: (n: number): number => Math.min(Math.max(1, Math.round(n / 4)), 256),
};

export async function initFxWasm(): Promise<void> {
  const mod = await import('@labpics/fx-wasm');
  await mod.default();
  wasm = {
    generateRadiusMap: (w, h, from, to, curve, axis) =>
      mod.generate_radius_map(w, h, from, to, curveIdx(curve), axisIdx(axis)),
    computePenumbra: (mask, w, h, angle, depth, scale) =>
      mod.compute_penumbra(mask, w, h, angle, depth, scale),
    proxyDim: (n) => mod.fx_proxy_dim(n),
  };
}

export function getWasm(): WasmFx {
  return wasm;
}

function curveIdx(c: Curve): number {
  return c === 'linear' ? 0 : c === 'ease-out' ? 1 : 2;
}

function axisIdx(a: Axis): number {
  return a === 'x' ? 0 : 1;
}
