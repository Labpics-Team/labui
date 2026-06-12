/**
 * @labpics/ui-fx — LabUI effects engine.
 *
 * WebGPU-first (WebGL2 fallback) pipeline for glass refraction (Fresnel +
 * chromatic aberration), progressive mip-map blur, and physically-correct
 * penumbra shadows from element masks.
 *
 * Part A: engine shaders + pipeline (engine/).
 * Part B: public API surfaces + texture bridge (api/, texture-bridge/, contract/).
 * Part C: WASM bridge — all CPU computation routes through Rust→WASM.
 */

// ── engine (Part A) ────────────────────────────────────────────────────
export {
  FxEngine,
  type LensConfig,
  type BlurConfig,
  type ShadowConfig,
} from './engine/pipeline.js';

export { WebGL2Fallback } from './engine/fallback.js';

// ── WASM bridge (Part C) ───────────────────────────────────────────────
export { initFxWasm, getWasm } from './engine/wasm-bridge.js';
export type { WasmFx } from './engine/wasm-bridge.js';

// ── API surfaces (Part B) ──────────────────────────────────────────────
export { GlassSurface } from './api/glass.js';
export type { GlassParams } from './api/glass.js';

export { ProgressiveBlur } from './api/blur.js';
export type { ProgressiveBlurParams } from './api/blur.js';

export { ProgressiveShadow } from './api/shadow.js';
export type { ProgressiveShadowParams } from './api/shadow.js';

// ── Texture bridge (Part B) ────────────────────────────────────────────
export {
  ImageTextureProvider,
  CanvasTextureProvider,
  VideoTextureProvider,
} from './texture-bridge/provider.js';
export type { GlassTextureProvider } from './texture-bridge/provider.js';

export { DOMSnapshotProvider } from './texture-bridge/snapshot.js';
export { TextureAtlas } from './texture-bridge/atlas.js';

// ── CSS token contract (Part B) ────────────────────────────────────────
export { FX_TOKEN_NAMES, readFxCssTokens } from './contract/tokens.js';
export type { FxTokenName, FxTokenValues } from './contract/tokens.js';
