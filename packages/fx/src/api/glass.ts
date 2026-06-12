import type { FxEngine } from '../engine/pipeline.js';
import type { LensConfig } from '../engine/pipeline.js';
import type { GlassTextureProvider } from '../texture-bridge/provider.js';

/**
 * Glass surface — the public API for the lens refraction effect.
 *
 * One GlassSurface per glass element on the page. The surface binds a
 * background texture provider (what's behind the glass) and the CSS
 * token-driven lens parameters. On `apply()`, it dispatches a single
 * `renderLens` pass through the engine.
 *
 * The surface owns a render-target texture sized to the glass element.
 * `resize()` recreates this texture when the element changes size.
 */
export class GlassSurface {
  private engine: FxEngine;
  private outputTexture: GPUTexture | null = null;
  private width = 0;
  private height = 0;

  constructor(engine: FxEngine) {
    this.engine = engine;
  }

  /**
   * Render one frame of the glass effect.
   *
   * `params.background` provides the low-res proxy texture of whatever
   * sits behind the glass. Lens parameters are read from the params
   * directly — the caller resolves CSS tokens via `readFxCssTokens()`.
   */
  apply(params: GlassParams): void {
    const { background } = params;

    // Ensure the output texture matches the glass element size.
    const w = Math.max(1, Math.round(params.width ?? background.rect.width));
    const h = Math.max(1, Math.round(params.height ?? background.rect.height));
    this.ensureOutputTexture(w, h);

    const config: LensConfig = {
      ior: params.ior,
      depth: params.depth,
      fresnelPower: params.fresnelPower,
      tint: params.tint,
      chromaticAberration: params.chromaticAberration,
      hasEnvmap: params.hasEnvmap ?? false,
    };

    this.engine.renderLens(background.texture, this.output.createView(), config);
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    this.recreateOutputTexture();
  }

  destroy(): void {
    this.outputTexture?.destroy();
    this.outputTexture = null;
  }

  private ensureOutputTexture(w: number, h: number): void {
    if (this.outputTexture && this.width === w && this.height === h) return;
    this.width = w;
    this.height = h;
    this.recreateOutputTexture();
  }

  private get output(): GPUTexture {
    if (!this.outputTexture)
      throw new Error('GlassSurface output texture not initialized — call apply() first');
    return this.outputTexture;
  }

  private recreateOutputTexture(): void {
    this.outputTexture?.destroy();
    this.outputTexture = this.engine.gpuDevice.createTexture({
      size: [this.width, this.height, 1],
      format: 'rgba16float',
      usage:
        GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_SRC,
    });
  }
}

export interface GlassParams {
  /** Refractive index per channel [r, g, b]. Default BK7_RGB_IOR ≈ [1.514, 1.519, 1.526]. */
  ior: [number, number, number];
  /** Apparent thickness in rem units. Drives refraction offset magnitude. */
  depth: number;
  /** Schlick fresnel power curve exponent. Higher = sharper edge reflection. */
  fresnelPower: number;
  /** Surface tint RGB, normalised 0–1. Read from --lab-glass-tint. */
  tint: [number, number, number];
  /** Colour-fringe splitting strength, 0–1. Default 0.3. */
  chromaticAberration: number;
  /** Enable environment cubemap reflection (WebGPU only; WebGL2 degrades to tint). */
  hasEnvmap?: boolean;
  /** Low-res proxy texture of the background behind the glass. */
  background: GlassTextureProvider;
  /** Glass element CSS width (defaults to background rect width). */
  width?: number;
  /** Glass element CSS height (defaults to background rect height). */
  height?: number;
}
