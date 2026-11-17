import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { decodePng } from '../../../packages/colors/test/fx-render/fx-render.mjs';
import {
  contourGeometry,
  materialContour,
} from '../../../packages/materials/src/engine/contour.ts';

const read = (name) => readFile(new URL(name, import.meta.url));
const png = async (name) => decodePng(await read(name));
const baseline = 'b18a753 optics with corrected diagnostic pattern/shadow bounds';
const refined = 'depth-bounded profile, base 0.4, index 2.8';

function measure(reference, images, width, height, distances, bands, excluded = () => false) {
  const rows = images.map(() =>
    bands.slice(1).map(() => ({ count: 0, abs: 0, chroma: 0, signed: [0, 0, 0], max: 0 })),
  );
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (excluded(x, y)) continue;
      const distance = distances(x + 0.5, y + 0.5);
      const band = bands.findIndex(
        (b, i) => i < bands.length - 1 && distance >= b && distance < bands[i + 1],
      );
      if (band < 0) continue;
      const at = (y * width + x) * 3;
      for (let image = 0; image < images.length; image++) {
        const row = rows[image][band];
        row.count++;
        const delta = [0, 1, 2].map((c) => images[image].rgb[at + c] - reference.rgb[at + c]);
        const mean = delta.reduce((sum, n) => sum + n, 0) / 3;
        for (let c = 0; c < 3; c++) {
          row.abs += Math.abs(delta[c]);
          row.chroma += Math.abs(delta[c] - mean);
          row.signed[c] += delta[c];
          row.max = Math.max(row.max, Math.abs(delta[c]));
        }
      }
    }
  return rows.map((ranges, i) => ({
    profile: [baseline, refined][i],
    bands: ranges.map((r, b) => ({
      range: [bands[b], bands[b + 1]],
      count: r.count,
      mae: r.abs / (r.count * 3),
      chroma: r.chroma / (r.count * 3),
      signed: r.signed.map((v) => v / r.count),
      max: r.max,
    })),
  }));
}

const effectsReference = await png('figma-glass-effects.png');
const effectsImages = await Promise.all(
  ['svg-pattern-web-glass-frost-0.5.png', 'refined-web-glass-frost-0.5.png'].map(png),
);
const effects = ['Soft', 'Muted', 'Base', 'Strong'].map((name, i) => {
  const cx = 260 + 344 * i;
  return {
    name,
    variants: measure(
      effectsReference,
      effectsImages,
      1552,
      520,
      (x, y) => 128 - Math.hypot(x - cx, y - 260),
      [-1, 0, 0.5, 1, 2, 3, 6, 12, 24, 48, 200],
      (x, y) => Math.abs(x - cx) < 65 && Math.abs(y - 260) < 24,
    ),
  };
});
const dockReference = await png('figma-dock-holdout.png');
const dockImages = await Promise.all(
  [
    'web-dock-shape-pegtop-contour-inner-bounds-baseline.png',
    'web-dock-shape-pegtop-contour-inner-bounds-refined.png',
  ].map(png),
);
const dockSource = JSON.parse(await read('figma-dock-holdout.json'));
const dock = dockSource.scene.children
  .filter((n) => n.effects.some((e) => e.type === 'GLASS') && n.x >= 0 && n.x + n.width <= 600)
  .map((node) => {
    const shape = materialContour(node.width, node.height, node.cornerRadius, 0.6);
    const normal = new Float64Array(2);
    return {
      id: node.id,
      variants: measure(
        dockReference,
        dockImages,
        600,
        452,
        (x, y) => contourGeometry(shape, x - node.x, y - node.y, normal),
        [0, 0.5, 1, 2, 4, 8, 16, 32, 1000],
        (x, y) => x < node.x || x >= node.x + node.width || y < node.y || y >= node.y + node.height,
      ),
    };
  });
const opticsSource = await read('../../../packages/materials/src/engine/glass-optics.ts');
await writeFile(
  new URL('glass-edge-comparison.json', import.meta.url),
  JSON.stringify(
    {
      measuredAt: new Date().toISOString(),
      opticsSourceSha256: createHash('sha256').update(opticsSource).digest('hex'),
      note: 'RGB errors include diagnostic composition differences; Effects parent noise is not reproduced. Samples use pixel centres and exclude title text.',
      effects,
      dock,
    },
    null,
    2,
  ),
);
console.info('Saved 4 Effects and 3 Dock contour-band comparisons.');
