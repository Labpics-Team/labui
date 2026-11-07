import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng } from '../../../packages/colors/test/fx-render/fx-render.mjs';
import { png } from './evidence.mjs';

// Инертное чтение Half PNG: признаки действия материала, без допуска к Figma fidelity.
// Один и тот же checker backdrop сравнивается внутри каждой Light/Dark пары.
export function sheetMaterialPixels(blur, solid) {
  for (const image of [blur, solid]) {
    assert.equal(image.width, 375);
    assert.equal(image.height, 812);
    assert.equal(image.rgb.length, image.width * image.height * 3);
  }
  const at = (image, x, y, channel) => image.rgb[(y * image.width + x) * 3 + channel];
  const columns = [34, 109, 187, 266, 341];
  function detail(image, first, last) {
    let total = 0;
    let samples = 0;
    for (const x of columns)
      for (let y = first + 1; y < last; y++)
        for (let channel = 0; channel < 3; channel++) {
          total += (at(image, x, y, channel) - at(image, x, y - 1, channel)) ** 2;
          samples++;
        }
    return total / samples;
  }
  let ghostChangedPixels = 0;
  for (let y = 0; y < 380; y++)
    for (let x = 10; x < 365; x++) {
      const offset = (y * blur.width + x) * 3;
      if (
        blur.rgb[offset] !== solid.rgb[offset] ||
        blur.rgb[offset + 1] !== solid.rgb[offset + 1] ||
        blur.rgb[offset + 2] !== solid.rgb[offset + 2]
      )
        ghostChangedPixels++;
    }
  const sharpTop = detail(solid, 20, 125);
  const sharpBottom = detail(solid, 275, 380);
  assert.ok(sharpTop > 0 && sharpBottom > 0, 'Sheet PNG needs a detailed source backdrop');
  const bands = columns.map((x) => {
    const mean = [0, 0, 0];
    let samples = 0;
    for (const row of [450, 600, 780])
      for (let y = row - 5; y <= row + 5; y++)
        for (let column = x - 5; column <= x + 5; column++) {
          for (let channel = 0; channel < 3; channel++)
            mean[channel] += at(blur, column, y, channel);
          samples++;
        }
    return mean.map((channel) => channel / samples);
  });
  return {
    ghostChangedPixels,
    ghostTopDetailRatio: detail(blur, 20, 125) / sharpTop,
    ghostBottomDetailRatio: detail(blur, 275, 380) / sharpBottom,
    bodyBandRgb: bands,
    bodyChroma: Math.max(...bands.map((band) => Math.max(...band) - Math.min(...band))),
    bodySpread: Math.max(
      ...[0, 1, 2].map((channel) => {
        const values = bands.map((band) => band[channel]);
        return Math.max(...values) - Math.min(...values);
      }),
    ),
  };
}

export function sheetMaterialPixelFailures(report) {
  const failures = [];
  if (!(report.ghostChangedPixels > 0)) failures.push('Ghost is byte-identical to Solid backdrop');
  if (!(report.ghostBottomDetailRatio < 1)) failures.push('Ghost keeps the sharp lower backdrop');
  if (!(report.ghostBottomDetailRatio < report.ghostTopDetailRatio))
    failures.push('Ghost has no progressive detail loss');
  // Разница больше одного RGB code выявляет цветной backdrop, не квалифицирует fidelity.
  if (!(report.bodyChroma > 1 && report.bodySpread > 1))
    failures.push('Body loses the colored source backdrop');
  return failures;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(
    process.argv.length,
    3,
    'Usage: node sheet-material-pixels.mjs DECODED_MATERIAL_DIRECTORY',
  );
  const directory = resolve(process.argv[2]);
  const identity = JSON.parse(await readFile(resolve(directory, 'identity.json'), 'utf8'));
  assert.match(identity.source, /^[a-f0-9]{40}$/);
  const reports = [];
  let failed = false;
  for (const theme of ['Light', 'Dark']) {
    const images = {};
    const hashes = {};
    for (const material of ['Blur', 'Solid']) {
      const name = `${theme}-${material}`;
      const observation = JSON.parse(await readFile(resolve(directory, `${name}.json`), 'utf8'));
      assert.equal(observation.theme, theme);
      assert.equal(observation.requestedMaterial, material);
      assert.equal(observation.effectiveMaterial, material);
      assert.equal(observation.rendererReady, true);
      assert.equal(observation.requestedState, 'Half');
      assert.equal(observation.body.y, 390);
      assert.equal(observation.rasterizationScale, 1);
      const bytes = await readFile(resolve(directory, `${name}.png`));
      assert.deepEqual(png(bytes), { width: 375, height: 812 });
      images[material] = decodePng(bytes);
      hashes[material] = createHash('sha256').update(bytes).digest('hex');
    }
    const report = sheetMaterialPixels(images.Blur, images.Solid);
    const missing = sheetMaterialPixelFailures(report);
    failed ||= missing.length > 0;
    reports.push({
      theme,
      hashes,
      ...report,
      effectPresence: missing.length ? 'FAIL' : 'PASS',
      missing,
      fidelity: 'pending',
    });
  }
  process.stdout.write(`${JSON.stringify({ source: identity.source, reports }, null, 2)}\n`);
  if (failed) process.exitCode = 1;
}
