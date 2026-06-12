import { FxEngine } from '../engine/pipeline.js';
import { getWasm } from '../engine/wasm-bridge.js';

/**
 * Contract for a background texture source behind a glass surface.
 *
 * Providers own a low-resolution GPU texture (1/4 native, capped at 256 px
 * in the larger dimension) plus metadata about its screen-space position.
 * Lens blur masks the low resolution — the human eye perceives only colour
 * masses through refracting glass, not sharp details.
 */
export interface GlassTextureProvider {
  /** Low-res proxy texture uploaded to the GPU. */
  readonly texture: GPUTexture;
  /** CSS-pixel rectangle relative to the glass surface origin. */
  readonly rect: { x: number; y: number; width: number; height: number };
  /** Native (pre-downscale) dimensions of the source. */
  readonly naturalSize: { width: number; height: number };
  /** Signal that the source content changed — triggers GPU re-upload. */
  invalidate(): void;
}

// ─── internal helpers ──────────────────────────────────────────────────

function getDevice(): GPUDevice {
  const device = FxEngine.device;
  if (!device) throw new Error('FxEngine not initialised — call FxEngine.create() first');
  return device;
}

/**
 * Clamp the native dimension to the low-res proxy size.
 * Delegates to WASM when available; falls back to JS `n/4` capped at 256.
 */
function proxyDim(native: number): number {
  try {
    return getWasm().proxyDim(native);
  } catch {
    return Math.min(Math.max(1, Math.round(native / 4)), 256);
  }
}

/** Combined texture usage flags for a proxy texture. */
const PROXY_USAGE: GPUTextureUsageFlags =
  GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT;

/**
 * Create a 2D rgba8unorm texture and upload pixel data from an image-like source.
 * The source must be an HTMLImageElement, HTMLCanvasElement, HTMLVideoElement,
 * ImageBitmap, or OffscreenCanvas.
 */
function uploadTexture(
  device: GPUDevice,
  source: GPUImageCopyExternalImageSource,
  width: number,
  height: number,
): GPUTexture {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const texture = device.createTexture({
    size: [w, h, 1],
    format: 'rgba8unorm',
    usage: PROXY_USAGE,
  });
  device.queue.copyExternalImageToTexture({ source, flipY: true }, { texture }, [w, h, 1]);
  return texture;
}

// ─── concrete providers ────────────────────────────────────────────────

/**
 * Image-backed texture provider.
 *
 * Loads an image from `src` (with CORS), downscales to proxy resolution,
 * and uploads to the GPU. Until the image decodes, `texture` returns a
 * 1×1 transparent placeholder — the glass degrades gracefully without
 * blocking the render loop.
 */
export class ImageTextureProvider implements GlassTextureProvider {
  private _texture: GPUTexture;
  private _image: HTMLImageElement;
  private _naturalWidth = 0;
  private _naturalHeight = 0;

  readonly rect: { x: number; y: number; width: number; height: number };
  readonly naturalSize: { width: number; height: number };

  constructor(src: string) {
    const device = getDevice();

    this._image = new Image();
    this._image.crossOrigin = 'anonymous';

    this._image.onload = () => {
      this._naturalWidth = this._image.naturalWidth;
      this._naturalHeight = this._image.naturalHeight;
      this._upload(device);
    };

    this._image.onerror = () => {
      console.warn(`[ui-fx] ImageTextureProvider: failed to load "${src}"`);
    };

    this._image.src = src;

    // Placeholder until image loads.
    this._texture = device.createTexture({
      size: [1, 1, 1],
      format: 'rgba8unorm',
      usage: PROXY_USAGE,
    });

    // rect and naturalSize update when the image loads.
    const self = this;
    this.rect = new Proxy({} as { x: number; y: number; width: number; height: number }, {
      get(_, key: keyof typeof self.rect) {
        if (key === 'width') return proxyDim(self._naturalWidth);
        if (key === 'height') return proxyDim(self._naturalHeight);
        return 0;
      },
    });

    this.naturalSize = new Proxy({} as { width: number; height: number }, {
      get(_, key: keyof typeof self.naturalSize) {
        if (key === 'width') return self._naturalWidth;
        return self._naturalHeight;
      },
    });
  }

  get texture(): GPUTexture {
    return this._texture;
  }

  invalidate(): void {
    if (this._image.complete) {
      this._upload(getDevice());
    }
  }

  private _upload(device: GPUDevice): void {
    const w = proxyDim(this._naturalWidth);
    const h = proxyDim(this._naturalHeight);
    this._texture.destroy();
    this._texture = uploadTexture(device, this._image, w, h);
  }
}

/**
 * Canvas-backed texture provider.
 *
 * Wraps a live `<canvas>` element. The texture is captured from the canvas
 * at construction time — `invalidate()` recaptures the current frame.
 */
export class CanvasTextureProvider implements GlassTextureProvider {
  readonly texture: GPUTexture;
  readonly rect: { x: number; y: number; width: number; height: number };
  readonly naturalSize: { width: number; height: number };
  private _canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas;
    const device = getDevice();
    const w = proxyDim(canvas.width);
    const h = proxyDim(canvas.height);

    this.naturalSize = { width: canvas.width, height: canvas.height };
    this.texture = uploadTexture(device, canvas, w, h);

    const bounds = canvas.getBoundingClientRect();
    this.rect = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  }

  invalidate(): void {
    const device = getDevice();
    const w = proxyDim(this._canvas.width);
    const h = proxyDim(this._canvas.height);
    device.queue.copyExternalImageToTexture(
      { source: this._canvas, flipY: true },
      { texture: this.texture },
      [w, h, 1],
    );
  }
}

/**
 * Video-backed texture provider.
 *
 * Wraps an HTML `<video>` element. The first available frame is captured
 * at construction time; `invalidate()` captures the current frame for
 * animated backgrounds.
 */
export class VideoTextureProvider implements GlassTextureProvider {
  readonly texture: GPUTexture;
  readonly rect: { x: number; y: number; width: number; height: number };
  readonly naturalSize: { width: number; height: number };
  private _video: HTMLVideoElement;

  constructor(video: HTMLVideoElement) {
    this._video = video;
    const device = getDevice();

    this.naturalSize = {
      width: video.videoWidth || 640,
      height: video.videoHeight || 360,
    };

    const w = proxyDim(this.naturalSize.width);
    const h = proxyDim(this.naturalSize.height);

    if (video.readyState >= 2) {
      this.texture = uploadTexture(device, video, w, h);
    } else {
      this.texture = device.createTexture({
        size: [1, 1, 1],
        format: 'rgba8unorm',
        usage: PROXY_USAGE,
      });
    }

    const bounds = video.getBoundingClientRect();
    this.rect = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  }

  invalidate(): void {
    const device = getDevice();
    const w = proxyDim(this.naturalSize.width);
    const h = proxyDim(this.naturalSize.height);
    device.queue.copyExternalImageToTexture(
      { source: this._video, flipY: true },
      { texture: this.texture },
      [w, h, 1],
    );
  }
}
