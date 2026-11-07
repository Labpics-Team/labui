import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng } from '../../../packages/colors/test/fx-render/fx-render.mjs';
import { png } from './evidence.mjs';
import {
  backdropHash,
  backdropProbeRegions,
  validateBackdropWitness,
} from './sheet-backdrop-fixture.mjs';

// Парная причинная проверка; входные RGBA вне R+margin одинаковы.
// Она доказывает соседскую зависимость, но не точный Gaussian или Figma fidelity.
export function sheetMaterialPixels(original, neighbor, bindings) {
  for (const image of [original, neighbor]) {
    assert.equal(image.width, 375);
    assert.equal(image.height, 812);
    assert.equal(image.rgb.length, image.width * image.height * 3);
  }
  for (const variant of ['A', 'B']) validateBackdropWitness(bindings[variant], variant);
  assert.deepEqual(bindings.A.fit, bindings.B.fit, 'backdrop pair fit differs');
  assert.deepEqual(bindings.A.paints, bindings.B.paints, 'backdrop pair paints differ');
  for (const field of [
    'bitmapPixels',
    'bounds',
    'stretch',
    'horizontalAlignment',
    'verticalAlignment',
  ])
    assert.deepEqual(
      bindings.A.image[field],
      bindings.B.image[field],
      `backdrop pair image ${field} differs`,
    );
  const regions = backdropProbeRegions(bindings.A);
  function reaction(region) {
    let changedPixels = 0;
    let brightenedChannels = 0;
    const delta = [0, 0, 0];
    for (let y = region.y; y < region.y + region.height; y++)
      for (let x = region.x; x < region.x + region.width; x++) {
        let changed = false;
        for (let channel = 0; channel < 3; channel++) {
          const offset = (y * original.width + x) * 3 + channel;
          const difference = neighbor.rgb[offset] - original.rgb[offset];
          changed ||= difference !== 0;
          brightenedChannels += difference > 0 ? 1 : 0;
          delta[channel] += difference;
        }
        changedPixels += changed ? 1 : 0;
      }
    const samples = region.width * region.height;
    return {
      changedPixels,
      brightenedChannels,
      meanRgbDelta: delta.map((value) => value / samples),
      meanDarkening: -delta.reduce((sum, value) => sum + value, 0) / (samples * 3),
    };
  }
  return {
    regions,
    ghost: reaction(regions.ghost),
    ghostFurther: reaction(regions.ghostFurther),
    body: reaction(regions.body),
    control: reaction(regions.control),
  };
}

export function sheetMaterialPixelFailures(report) {
  const failures = [];
  for (const [name, reaction] of [
    ['Ghost', report.ghost],
    ['Body', report.body],
  ])
    if (
      !(
        reaction.changedPixels > 0 &&
        reaction.brightenedChannels === 0 &&
        reaction.meanDarkening > 0
      )
    )
      failures.push(`${name} has no coherent neighbor response outside changed source footprint`);
  if (
    !(
      report.ghost.meanDarkening > report.ghostFurther.meanDarkening &&
      report.ghostFurther.brightenedChannels === 0
    )
  )
    failures.push('Ghost response does not decay away from changed source footprint');
  // Top Ghost находится за support всех Ghost ветвей; Body far control не требуется.
  if (report.control.changedPixels !== 0)
    failures.push('Unchanged far backdrop control reacted: noise or unrelated frame change');
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
    const observations = {};
    const hashes = {};
    for (const suffix of ['Blur', 'Solid', 'Blur-Neighbor']) {
      const name = `${theme}-${suffix}`;
      const bytes = await readFile(resolve(directory, `${name}.png`));
      assert.deepEqual(png(bytes), { width: 375, height: 812 });
      const observation = JSON.parse(await readFile(resolve(directory, `${name}.json`), 'utf8'));
      assert.equal(observation.theme, theme);
      assert.equal(observation.requestedMaterial, suffix === 'Solid' ? 'Solid' : 'Blur');
      assert.equal(observation.effectiveMaterial, observation.requestedMaterial);
      assert.equal(observation.rendererReady, true);
      assert.equal(observation.requestedState, 'Half');
      assert.equal(observation.body.y, 390);
      assert.equal(observation.rasterizationScale, 1);
      images[suffix] = decodePng(bytes);
      observations[suffix] = observation;
      hashes[suffix] = backdropHash(bytes);
    }
    const report = sheetMaterialPixels(images.Blur, images['Blur-Neighbor'], {
      A: observations.Blur.backdropWitness,
      B: observations['Blur-Neighbor'].backdropWitness,
    });
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
