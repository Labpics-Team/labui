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
import { ORDER_BACKDROPS } from './sheet-order-fixture.mjs';

function validateImages(images) {
  for (const image of images) {
    assert.equal(image.width, 375);
    assert.equal(image.height, 812);
    assert.equal(image.rgb.length, image.width * image.height * 3);
  }
}

function validateBindings(bindings, variants) {
  const reference = bindings[variants[0]];
  for (const variant of variants) {
    const binding = bindings[variant];
    validateBackdropWitness(binding, variant);
    assert.deepEqual(binding.fit, reference.fit, 'backdrop controls fit differs');
    assert.deepEqual(binding.paints, reference.paints, 'backdrop controls paints differ');
    for (const field of [
      'bitmapPixels',
      'bounds',
      'stretch',
      'horizontalAlignment',
      'verticalAlignment',
    ])
      assert.deepEqual(
        binding.image[field],
        reference.image[field],
        `backdrop controls image ${field} differs`,
      );
  }
}

// Парная причинная проверка; входные RGBA вне R+margin одинаковы.
// Она доказывает соседскую зависимость, но не точный Gaussian или Figma fidelity.
export function sheetMaterialPixels(original, neighbor, bindings) {
  validateImages([original, neighbor]);
  validateBindings(bindings, ['A', 'B']);
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
    bodyOpposite: reaction(regions.bodyOpposite),
    control: reaction(regions.control),
  };
}

export function sheetMaterialPixelFailures(report) {
  const failures = [];
  // Authored Light ColorDodge может насытить одну сторону до белого.
  // Обе области вне изменённого source: нужен отклик хотя бы одной и ни одного осветления.
  for (const [name, reactions] of [
    ['Ghost', [report.ghost]],
    ['Body', [report.body, report.bodyOpposite]],
  ])
    if (
      !(
        reactions.some((reaction) => reaction.changedPixels > 0 && reaction.meanDarkening > 0) &&
        reactions.every((reaction) => reaction.brightenedChannels === 0)
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

// Constant captures measure the same native paints and deterministic noise as
// the stripe capture. A nonlinear paint before blur yields the endpoint mean;
// blur before paint yields the gray control. This qualifies order, not fidelity.
export function sheetOrderPixels(images, bindings) {
  validateImages(ORDER_BACKDROPS.map((variant) => images[variant]));
  validateBindings(bindings, ORDER_BACKDROPS);
  const region = { x: 64, y: 600, width: 256, height: 160 };
  const sums = Object.fromEntries(ORDER_BACKDROPS.map((variant) => [variant, [0, 0, 0]]));
  const columnResiduals = [];
  for (let x = region.x; x < region.x + region.width; x++) {
    const column = [0, 0, 0];
    for (let y = region.y; y < region.y + region.height; y++)
      for (let channel = 0; channel < 3; channel++) {
        const offset = (y * 375 + x) * 3 + channel;
        for (const variant of ORDER_BACKDROPS)
          sums[variant][channel] += images[variant].rgb[offset];
        // Subtract the per-pixel controls before testing spatial variation, so
        // the shared native noise does not masquerade as an unblurred stripe.
        column[channel] +=
          images.OrderStripes.rgb[offset] -
          (images.OrderBlack.rgb[offset] + images.OrderWhite.rgb[offset]) / 2;
      }
    columnResiduals.push(column.map((value) => value / region.height));
  }
  const meanRgb = Object.fromEntries(
    ORDER_BACKDROPS.map((variant) => [
      variant,
      sums[variant].map((value) => value / (region.width * region.height)),
    ]),
  );
  const endpointMean = meanRgb.OrderBlack.map((value, c) => (value + meanRgb.OrderWhite[c]) / 2);
  const distance = (left, right) =>
    left.reduce((sum, value, c) => sum + Math.abs(value - right[c]), 0) / 3;
  return {
    region,
    meanRgb,
    endpointMean,
    controlGap: distance(endpointMean, meanRgb.OrderGray),
    endpointError: distance(meanRgb.OrderStripes, endpointMean),
    grayError: distance(meanRgb.OrderStripes, meanRgb.OrderGray),
    columnResidualSpan: Math.max(
      ...[0, 1, 2].map((channel) => {
        const values = columnResiduals.map((column) => column[channel]);
        return Math.max(...values) - Math.min(...values);
      }),
    ),
    // A finite clamped blur legitimately retains a broad edge gradient.
    // The second difference cancels a linear gradient while retaining a
    // 32-DIP stripe period; divide by four to report its RGB amplitude.
    stripeResidualAmplitude: Math.max(
      ...columnResiduals
        .slice(0, -32)
        .flatMap((column, x) =>
          column.map(
            (value, channel) =>
              Math.abs(
                value - 2 * columnResiduals[x + 16][channel] + columnResiduals[x + 32][channel],
              ) / 4,
          ),
        ),
    ),
  };
}

export function sheetOrderPixelFailures(report) {
  const failures = [];
  if (!(report.controlGap >= 4))
    failures.push(
      'Body order controls do not distinguish paint before blur from blur before paint',
    );
  if (!(report.endpointError <= 1.5 && report.grayError >= report.endpointError + 2))
    failures.push('Body stripe mean does not follow paint before blur');
  if (!(report.stripeResidualAmplitude <= 1.5))
    failures.push('Body stripe residual retains sharp spatial variation');
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
    for (const suffix of [
      'Blur',
      'Solid',
      'Blur-Neighbor',
      ...ORDER_BACKDROPS.map((variant) => `Blur-${variant}`),
    ]) {
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
    const order = sheetOrderPixels(
      Object.fromEntries(ORDER_BACKDROPS.map((variant) => [variant, images[`Blur-${variant}`]])),
      Object.fromEntries(
        ORDER_BACKDROPS.map((variant) => [
          variant,
          observations[`Blur-${variant}`].backdropWitness,
        ]),
      ),
    );
    const orderMissing = sheetOrderPixelFailures(order);
    failed ||= missing.length > 0 || orderMissing.length > 0;
    reports.push({
      theme,
      hashes,
      ...report,
      effectPresence: missing.length ? 'FAIL' : 'PASS',
      missing,
      order: { ...order, verdict: orderMissing.length ? 'FAIL' : 'PASS', missing: orderMissing },
      fidelity: 'pending',
    });
  }
  process.stdout.write(`${JSON.stringify({ source: identity.source, reports }, null, 2)}\n`);
  if (failed) process.exitCode = 1;
}
