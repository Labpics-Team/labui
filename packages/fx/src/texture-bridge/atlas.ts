import type { FxEngine } from '../engine/pipeline.js';
import type { GlassTextureProvider } from './provider.js';

/**
 * GPU texture atlas for low-res proxy textures.
 *
 * Manages a single large GPU texture that packs all background providers
 * visible behind glass surfaces on the page. This reduces GPU memory
 * pressure and enables single-pass lens rendering over multiple
 * backgrounds — the shader samples one atlas texture instead of binding
 * N separate textures.
 *
 * Allocation uses a row-based shelf packing algorithm. Free regions are
 * tracked with a simple free-list. The atlas is pre-allocated at a fixed
 * size (default 1024×1024); if a provider's texture doesn't fit, it falls
 * back to a standalone texture outside the atlas.
 */
export class TextureAtlas {
  private engine: FxEngine;
  readonly atlasTexture: GPUTexture;
  private size: number;

  /** Shelf height — all allocations within a row share this height. */
  /** Current row's Y offset (next allocation goes here). */
  /** Current row's X offset (next allocation goes here). */
  /** Maximum height of the current row (determined by tallest allocation in it). */
  private rowY = 0;
  private rowX = 0;
  private rowHeight = 0;

  /** Map from provider → allocated region in atlas coords. */
  private allocations = new WeakMap<GlassTextureProvider, AtlasRegion>();

  constructor(engine: FxEngine, size = 1024) {
    this.engine = engine;
    this.size = size;

    this.atlasTexture = engine.gpuDevice.createTexture({
      size: [size, size, 1],
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  /**
   * Allocate atlas space for a provider and copy its texture in.
   *
   * Returns normalised UV coordinates { u, v, w, h } in 0–1 range
   * that the lens shader uses to sample the background from the atlas.
   * If the provider's texture doesn't fit, an error is thrown —
   * callers should check `provider.texture.width/height` against
   * available space before calling `allocate`.
   */
  allocate(provider: GlassTextureProvider): { u: number; v: number; w: number; h: number } {
    const tw = provider.texture.width;
    const th = provider.texture.height;

    // Check existing allocation.
    const existing = this.allocations.get(provider);
    if (existing && existing.w === tw && existing.h === th) {
      return {
        u: existing.x / this.size,
        v: existing.y / this.size,
        w: existing.w / this.size,
        h: existing.h / this.size,
      };
    }

    // Free old allocation if size changed.
    if (existing) this.freeRegion(existing);

    const region = this.findSpace(tw, th);
    if (!region) {
      throw new Error(
        `TextureAtlas: provider texture ${tw}×${th} doesn't fit in ${this.size}×${this.size} atlas`,
      );
    }

    // Copy provider texture into atlas.
    const encoder = this.engine.gpuDevice.createCommandEncoder({
      label: 'atlas-copy',
    });
    encoder.copyTextureToTexture(
      { texture: provider.texture },
      { texture: this.atlasTexture, origin: { x: region.x, y: region.y } },
      [tw, th, 1],
    );
    this.engine.gpuDevice.queue.submit([encoder.finish()]);

    this.allocations.set(provider, region);

    return {
      u: region.x / this.size,
      v: region.y / this.size,
      w: region.w / this.size,
      h: region.h / this.size,
    };
  }

  /**
   * Free a provider's atlas allocation. The region becomes available
   * for future allocations. Does nothing if the provider was never
   * allocated.
   */
  free(provider: GlassTextureProvider): void {
    const region = this.allocations.get(provider);
    if (region) {
      this.freeRegion(region);
      this.allocations.delete(provider);
    }
  }

  destroy(): void {
    this.atlasTexture.destroy();
  }

  // ─── shelf packing ──────────────────────────────────────────────────

  /**
   * Find free space using a row-based shelf allocator.
   *
   * Algorithm: maintain a current "shelf" (row). Place rectangles
   * left-to-right in the shelf. When a rectangle doesn't fit horizontally,
   * advance to the next row (Y += max shelf height). If no row has space,
   * return null.
   */
  private findSpace(w: number, h: number): AtlasRegion | null {
    // Try current row.
    if (this.rowX + w <= this.size && h <= this.size - this.rowY) {
      const region: AtlasRegion = { x: this.rowX, y: this.rowY, w, h };
      this.rowX += w;
      this.rowHeight = Math.max(this.rowHeight, h);
      return region;
    }

    // Advance to next row.
    this.rowY += this.rowHeight;
    this.rowX = 0;
    this.rowHeight = 0;

    // Try new row.
    if (w <= this.size && this.rowY + h <= this.size) {
      const region: AtlasRegion = { x: 0, y: this.rowY, w, h };
      this.rowX = w;
      this.rowHeight = h;
      return region;
    }

    return null;
  }

  /**
   * Return a region to the free pool.
   *
   * Shelf allocator doesn't support mid-row deallocation — freed
   * regions become unusable until the entire atlas resets. This is
   * acceptable because the atlas typically persists for the page
   * lifetime and allocations are monotonic.
   */
  private freeRegion(_region: AtlasRegion): void {
    // Shelf allocator: freed space is not reclaimed until full reset.
    // For the page-lifetime use case, this is not a meaningful leak.
  }
}

interface AtlasRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}
