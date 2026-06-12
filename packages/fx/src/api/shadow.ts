import type { FxEngine } from '../engine/pipeline.js';
import type { ShadowConfig } from '../engine/pipeline.js';
import type { GlassTextureProvider } from '../texture-bridge/provider.js';

/**
 * Progressive shadow surface.
 *
 * Renders a physically-correct penumbra shadow from an element's alpha
 * mask. The penumbra is soft near the occluder and sharpens at the
 * silhouette edge — the reverse of a standard CSS box-shadow.
 *
 * The caller provides an `element` mask texture (white = occluder,
 * black = background) and shadow parameters. The engine runs a compute
 * shader that traces from each pixel toward the light source, measuring
 * occlusion distance to determine local penumbra width.
 */
export class ProgressiveShadow {
  private engine: FxEngine;
  private outputTexture: GPUTexture | null = null;
  private width = 0;
  private height = 0;

  constructor(engine: FxEngine) {
    this.engine = engine;
  }

  /**
   * Dispatch a penumbra shadow render.
   *
   * The output is a single-channel (R16F) texture encoding shadow
   * intensity — 0 = fully lit, 1 = fully occluded. The caller composites
   * this with the scene using the surface tint colour.
   */
  apply(params: ProgressiveShadowParams): void {
    const { element } = params;

    const w = Math.max(1, Math.round(element.rect.width));
    const h = Math.max(1, Math.round(element.rect.height));
    this.ensureOutputTexture(w, h);

    const config: ShadowConfig = {
      depth: params.depth,
      lightAngle: params.lightAngle,
      penumbraScale: params.penumbraScale,
    };

    this.engine.renderPenumbra(element.texture, this.output, config);
  }

  destroy(): void {
    this.outputTexture?.destroy();
    this.outputTexture = null;
  }

  private get output(): GPUTexture {
    if (!this.outputTexture)
      throw new Error('ProgressiveShadow output texture not initialized — call apply() first');
    return this.outputTexture;
  }

  private ensureOutputTexture(w: number, h: number): void {
    if (this.outputTexture && this.width === w && this.height === h) return;
    this.width = w;
    this.height = h;

    this.outputTexture?.destroy();
    this.outputTexture = this.engine.gpuDevice.createTexture({
      size: [w, h, 1],
      format: 'r16float',
      usage:
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_SRC,
    });
  }
}

export interface ProgressiveShadowParams {
  /** Elevation depth in rem — controls shadow throw distance. */
  depth: number;
  /** Light angle in degrees measured from vertical. 0 = straight down. */
  lightAngle: number;
  /** 0–1 penumbra softness. 0 = hard shadow, 1 = fully soft. */
  penumbraScale: number;
  /** Shadow tint RGB, normalised 0–1. Read from --lab-surface-shadow-tint. */
  tint: [number, number, number];
  /** Alpha mask texture of the occluding element (white = solid). */
  element: GlassTextureProvider;
}
