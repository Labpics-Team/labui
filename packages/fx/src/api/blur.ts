import type { FxEngine } from '../engine/pipeline.js';
import type { BlurConfig } from '../engine/pipeline.js';
import type { GlassTextureProvider } from '../texture-bridge/provider.js';
import { getWasm } from '../engine/wasm-bridge.js';

/**
 * Progressive (variable-radius) blur surface.
 *
 * Renders a blur whose radius varies across the surface — sharp at one
 * edge, fully blurred at the opposite edge — producing the visual effect
 * of a frosted-glass gradient. The radius gradient is driven by a
 * `radiusMap` texture where each pixel encodes its own blur radius.
 *
 * The caller provides:
 * - `content`: the texture to blur (low-res proxy of the underlying content)
 * - A per-pixel `radiusMap` generated from `config` parameters
 * - The engine applies a separable two-pass mip-map blur
 */
export class ProgressiveBlur {
  private engine: FxEngine;
  private outputTexture: GPUTexture | null = null;
  private radiusMap: GPUTexture | null = null;
  private width = 0;
  private height = 0;

  constructor(engine: FxEngine) {
    this.engine = engine;
  }

  /**
   * Dispatch a progressive blur pass.
   *
   * The radius map is a single-channel float texture where 0 = no blur
   * and 1 = maximum blur (`params.to`). The engine samples this map
   * per-pixel to determine the local blur radius.
   */
  apply(params: ProgressiveBlurParams): void {
    const { content } = params;

    const w = Math.max(1, Math.round(content.rect.width));
    const h = Math.max(1, Math.round(content.rect.height));
    this.ensureTextures(w, h);

    // Build the radius map: a gradient encoding per-pixel blur radii.
    // Positive axis = blur increases along the gradient direction.
    this.writeRadiusMap(params);

    const config: BlurConfig = {
      fromRadius: params.from,
      toRadius: params.to,
      curve: params.curve,
      axis: params.axis,
    };

    this.engine.progressiveBlur(content.texture, this.rm, this.output, config);
  }

  destroy(): void {
    this.outputTexture?.destroy();
    this.outputTexture = null;
    this.radiusMap?.destroy();
    this.radiusMap = null;
  }

  private get output(): GPUTexture {
    if (!this.outputTexture) throw new Error('ProgressiveBlur output texture not initialized');
    return this.outputTexture;
  }

  private get rm(): GPUTexture {
    if (!this.radiusMap) throw new Error('ProgressiveBlur radius map not initialized');
    return this.radiusMap;
  }

  private ensureTextures(w: number, h: number): void {
    if (this.outputTexture && this.width === w && this.height === h) return;
    this.width = w;
    this.height = h;

    this.outputTexture?.destroy();
    this.outputTexture = this.engine.gpuDevice.createTexture({
      size: [w, h, 1],
      format: 'rgba16float',
      usage:
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_SRC,
    });

    this.radiusMap?.destroy();
    this.radiusMap = this.engine.gpuDevice.createTexture({
      size: [w, h, 1],
      format: 'r16float',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
  }

  /**
   * Write per-pixel radii into `radiusMap`.
   *
   * Radius map computation is delegated to WASM (Rust) to avoid the
   * CPU→GPU upload bottleneck on large surfaces (>2048 px).
   */
  private writeRadiusMap(params: ProgressiveBlurParams): void {
    const wasm = getWasm();
    const pixels = wasm.generateRadiusMap(
      this.width,
      this.height,
      params.from,
      params.to,
      params.curve,
      params.axis,
    );
    this.engine.gpuDevice.queue.writeTexture(
      { texture: this.rm },
      pixels,
      { bytesPerRow: this.width * 4, rowsPerImage: this.height },
      [this.width, this.height, 1],
    );
  }
}

export interface ProgressiveBlurParams {
  /** Blur radius in pixels at the sharp edge. */
  from: number;
  /** Blur radius in pixels at the blurry edge. */
  to: number;
  /** Radius interpolation curve. */
  curve: 'linear' | 'ease-out' | 'ease-in-out';
  /** Direction of the blur gradient. */
  axis: 'x' | 'y';
  /** Low-res proxy texture of the content to blur. */
  content: GlassTextureProvider;
}
