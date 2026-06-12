// Stub — replaced by wasm-pack build output after Rust agent completes.
// For now, this package builds clean and throws at runtime.

export default async function init(): Promise<void> {
  // When Rust WASM is built:
  //   const mod = await import('./fx_wasm.js');
  //   await mod.default();
  throw new Error(
    '@labpics/fx-wasm: WASM binary not yet built. Run wasm-pack build in crates/fx-wasm.',
  );
}

export function generate_radius_map(..._args: unknown[]): Float32Array {
  throw new Error('WASM not loaded');
}

export function compute_penumbra(..._args: unknown[]): Float32Array {
  throw new Error('WASM not loaded');
}

export function fx_proxy_dim(native: number): number {
  return Math.min(Math.max(1, Math.round(native / 4)), 256);
}
