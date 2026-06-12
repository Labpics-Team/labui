import { FxEngine } from '../engine/pipeline.js';
import type { GlassTextureProvider } from './provider.js';

/**
 * DOM-to-texture snapshot provider.
 *
 * Renders an arbitrary HTMLElement to a low-resolution canvas (1/4 native,
 * capped at `maxTextureSize` px in the larger dimension) and uploads to the
 * GPU. Used when the glass background is rich HTML — CMS content, styled
 * text, complex layouts — rather than a simple image/video source.
 *
 * The render path uses SVG `<foreignObject>` embedding to capture the
 * element's painted appearance without external dependencies (no
 * html2canvas, no getComputedStyle scraping).
 *
 * Limitations:
 *   - Externally-loaded resources (fonts, cross-origin images) may not
 *     render without proper CORS headers.
 *   - The snapshot is a static image — call `invalidate()` when the
 *     underlying DOM changes.
 *   - SVG foreignObject rendering fidelity varies across browsers; the
 *     low-res downscale masks most artefacts.
 */
export class DOMSnapshotProvider implements GlassTextureProvider {
  private _texture: GPUTexture;
  private _element: HTMLElement;
  private _naturalWidth = 0;
  private _naturalHeight = 0;
  private _proxyW = 0;
  private _proxyH = 0;

  readonly rect: { x: number; y: number; width: number; height: number };
  readonly naturalSize: { width: number; height: number };

  constructor(element: HTMLElement, maxTextureSize = 256) {
    this._element = element;

    const bounds = element.getBoundingClientRect();
    this._naturalWidth = Math.round(bounds.width);
    this._naturalHeight = Math.round(bounds.height);
    this._proxyW = Math.min(Math.max(1, Math.round(this._naturalWidth / 4)), maxTextureSize);
    this._proxyH = Math.min(Math.max(1, Math.round(this._naturalHeight / 4)), maxTextureSize);

    this.rect = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    this.naturalSize = { width: this._naturalWidth, height: this._naturalHeight };

    this._texture = createPlaceholderTexture();
    this.scheduleSnapshot();
  }

  get texture(): GPUTexture {
    return this._texture;
  }

  invalidate(): void {
    this.scheduleSnapshot();
  }

  /**
   * Schedule an async DOM snapshot via rAF.
   *
   * The SVG foreignObject → Image → GPU texture pipeline is inherently
   * async because image decoding is off-main-thread. We use
   * requestAnimationFrame so the browser paints the latest DOM state
   * before we capture.
   */
  private scheduleSnapshot(): void {
    requestAnimationFrame(() => {
      const dataUrl = buildSvgSnapshot(this._element, this._proxyW, this._proxyH);
      const img = new Image();
      img.onload = () => {
        const device = FxEngine.device;
        if (!device) return;

        // Upload the decoded SVG raster to the GPU.
        this._texture.destroy();
        this._texture = device.createTexture({
          size: [this._proxyW, this._proxyH, 1],
          format: 'rgba8unorm',
          usage:
            GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT,
        });
        device.queue.copyExternalImageToTexture(
          { source: img, flipY: true },
          { texture: this._texture },
          [this._proxyW, this._proxyH, 1],
        );
      };
      img.src = dataUrl;
    });
  }
}

// ─── helpers ───────────────────────────────────────────────────────────

function createPlaceholderTexture(): GPUTexture {
  const device = FxEngine.device;
  if (!device) throw new Error('FxEngine not initialised');
  return device.createTexture({
    size: [1, 1, 1],
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });
}

/**
 * Build an SVG data URL that renders the element inside a `<foreignObject>`.
 *
 * The technique:
 * 1. Collect layout-critical computed styles from the element.
 * 2. Serialise the element's outerHTML.
 * 3. Embed both inside an SVG `<foreignObject>` with the target dimensions.
 * 4. Encode as a `data:image/svg+xml` URL for decoding by an Image.
 *
 * The SVG acts as a browser-native rasteriser — no external libraries,
 * no pixel-reading. The output is a static image at the target resolution.
 */
function buildSvgSnapshot(element: HTMLElement, width: number, height: number): string {
  const styleString = collectSnapshotStyles(element);
  const html = element.outerHTML;

  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="',
    String(width),
    '" height="',
    String(height),
    '">',
    '<foreignObject width="100%" height="100%">',
    '<div xmlns="http://www.w3.org/1999/xhtml" style="',
    styleString,
    '">',
    html,
    '</div>',
    '</foreignObject>',
    '</svg>',
  ].join('');

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Collect layout-affecting computed styles into a CSS string for inlining.
 *
 * We only capture properties that affect the visual appearance —
 * not every computed style. This keeps the SVG payload small while
 * faithfully reproducing the element's look.
 */
function collectSnapshotStyles(element: HTMLElement): string {
  const props = [
    'color',
    'background-color',
    'background-image',
    'font-family',
    'font-size',
    'font-weight',
    'font-style',
    'line-height',
    'text-align',
    'text-decoration',
    'white-space',
    'word-wrap',
    'display',
    'position',
    'width',
    'height',
    'padding',
    'margin',
    'border',
    'border-radius',
    'box-sizing',
    'opacity',
    'overflow',
    'transform',
    'filter',
    'backdrop-filter',
  ];

  const styles = getComputedStyle(element);
  return props.map((prop) => `${prop}: ${styles.getPropertyValue(prop)}`).join('; ');
}
