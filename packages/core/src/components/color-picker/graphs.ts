import type { ChartRenderer, GamutLayer } from '@colordx/gpu';
import {
  type ColorPlane,
  type LabColorValue,
  clamp,
  colorCoords,
  colorInGamut,
  colorPlaneAxes,
  editColorPlane,
} from './contract.js';

/** Ready-made, parity-tested CIELCH D50 shaders. CPU fallback uses the same public codec. */
export function mountColorGraphs(root: HTMLElement) {
  const canvases = new Map<
    HTMLCanvasElement,
    { key: string; renderer: ChartRenderer | null; ready: boolean }
  >();
  let disposed = false;
  let latest: { value: LabColorValue; p3: boolean; rec2020: boolean } | undefined;
  let frame = 0;
  const view = root.ownerDocument.defaultView;
  if (!view) throw new Error('Color graphs require a browser document');
  const fallback = async (
    canvas: HTMLCanvasElement,
    plane: ColorPlane,
    value: LabColorValue,
    p3: boolean,
    rec2020: boolean,
    key: string,
  ) => {
    const context = canvas.getContext('2d');
    if (!context) return;
    // CSS-pixel resolution with cooperative 6 ms slices; stale work is cancelled.
    const width = Math.max(1, Math.ceil(canvas.clientWidth));
    canvas.width = width;
    const height = Math.max(1, Math.ceil(canvas.clientHeight));
    canvas.height = height;
    const pixels = context.createImageData(width, height);
    let sliceStart = performance.now();
    const paintStart = sliceStart;
    for (let y = 0; y < height; y++) {
      if (disposed || canvases.get(canvas)?.key !== key || !root.contains(canvas)) return;
      for (let x = 0; x < width; x++) {
        const color = editColorPlane(
          value,
          plane,
          x / Math.max(1, width - 1),
          1 - y / Math.max(1, height - 1),
          rec2020,
        );
        const visible =
          colorInGamut(color, 'srgb') ||
          (p3 && colorInGamut(color, 'p3')) ||
          (rec2020 && colorInGamut(color, 'rec2020'));
        if (!visible) continue;
        const rgb = colorCoords(color, 'srgb');
        const i = (y * width + x) * 4;
        for (let c = 0; c < 3; c++)
          pixels.data[i + c] = Math.round(clamp(rgb[c as 0 | 1 | 2]) * 255);
        pixels.data[i + 3] = 255;
      }
      if (performance.now() - sliceStart > 6) {
        await new Promise((resolve) => view.setTimeout(resolve, 0));
        sliceStart = performance.now();
      }
    }
    if (disposed || canvases.get(canvas)?.key !== key || !root.contains(canvas)) return;
    context.putImageData(pixels, 0, 0);
    canvas.dataset.renderer = 'cpu';
    canvas.dataset.paintMs = String(performance.now() - paintStart);
    canvas.dataset.paintCount = String(Number(canvas.dataset.paintCount ?? 0) + 1);
  };
  const paint = () => {
    frame = 0;
    if (disposed || !latest) return;
    const { value, p3, rec2020 } = latest;
    const coords = colorCoords(value, 'lch');
    for (const [canvas, entry] of canvases) {
      if (!root.contains(canvas)) {
        entry.renderer?.destroy();
        canvases.delete(canvas);
        continue;
      }
      if (!entry.ready) continue;
      const plane = canvas.dataset.graph as 'l' | 'c' | 'h';
      const fixed = coords[plane === 'l' ? 0 : plane === 'c' ? 1 : 2];
      const axes = colorPlaneAxes(value, plane, rec2020);
      const key = `${plane}:${fixed}:${canvas.clientWidth}:${canvas.clientHeight}:${p3}:${rec2020}:${view.devicePixelRatio}`;
      if (entry.key === key) continue;
      entry.key = key;
      const start = performance.now();
      if (entry.renderer) {
        canvas.width = Math.max(1, Math.round(canvas.clientWidth * view.devicePixelRatio));
        canvas.height = Math.max(1, Math.round(canvas.clientHeight * view.devicePixelRatio));
        const gamuts: GamutLayer[] = [
          { space: 'srgb', fill: true, border: p3 || rec2020 ? [0.2, 0.2, 0.2, 0.4] : undefined },
        ];
        if (p3) gamuts.push({ space: 'p3', fill: true, border: [0.4, 0.4, 0.4, 0.6] });
        if (rec2020) gamuts.push({ space: 'rec2020', fill: true, border: [0.6, 0.6, 0.6, 0.7] });
        entry.renderer.paint({
          plane: plane === 'l' ? 'ch' : plane === 'c' ? 'lh' : 'cl',
          value: fixed,
          xMax: axes.xMax,
          yMax: axes.yMax,
          gamuts,
          p3Output: view.matchMedia('(color-gamut: p3)').matches,
          borderWidth: view.devicePixelRatio,
        });
        canvas.dataset.renderer = 'webgl2';
      } else {
        void fallback(canvas, plane, value, p3, rec2020, key);
        continue;
      }
      canvas.dataset.paintMs = String(performance.now() - start);
      canvas.dataset.paintCount = String(Number(canvas.dataset.paintCount ?? 0) + 1);
    }
  };
  const schedule = () => {
    if (!frame && !disposed) frame = view.requestAnimationFrame(paint);
  };
  const resize = new ResizeObserver(schedule);
  resize.observe(root);
  return {
    update(value: LabColorValue, p3: boolean, rec2020: boolean) {
      latest = { value, p3, rec2020 };
      for (const canvas of root.querySelectorAll<HTMLCanvasElement>('canvas[data-graph]')) {
        if (canvases.has(canvas)) continue;
        const entry = { key: '', renderer: null as ChartRenderer | null, ready: false };
        canvases.set(canvas, entry);
        import('@colordx/gpu')
          .then(({ createChartRenderer }) => {
            if (disposed || !root.contains(canvas)) return;
            entry.renderer = createChartRenderer(canvas, { model: 'lch' });
            entry.ready = true;
            schedule();
          })
          .catch(() => {
            entry.ready = true;
            schedule();
          });
      }
      schedule();
    },
    dispose() {
      disposed = true;
      view.cancelAnimationFrame(frame);
      resize.disconnect();
      for (const entry of canvases.values()) entry.renderer?.destroy();
      canvases.clear();
    },
  };
}
