import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync, inflateSync } from 'node:zlib';
import { png } from './evidence.mjs';
import { serializeBackdropFixture } from './sheet-fixture-descriptor.mjs';
import { ORDER_BACKDROPS, createOrderBackdrop } from './sheet-order-fixture.mjs';

const directory = new URL('../../../examples/windows/Assets/', import.meta.url);
const descriptorUrl = new URL('SheetBackdropWitness.json', directory);
const descriptorBytes = readFileSync(descriptorUrl);
export const BACKDROP_FIXTURE = JSON.parse(descriptorBytes);
export const backdropHash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const BACKDROP_FIXTURE_HASH = backdropHash(descriptorBytes);
export const BACKDROP_PAINTS = ['tint', 'blend', 'ghost', 'border', 'noise', 'shadowInk', 'solid'];
const keys = (value, expected) => assert.deepEqual(Object.keys(value).sort(), expected.toSorted());

function fixtureScanlines(source) {
  const before = [];
  const data = [];
  for (let offset = 8; offset < source.length; ) {
    const length = source.readUInt32BE(offset);
    const name = source.toString('ascii', offset + 4, offset + 8);
    const chunk = source.subarray(offset, offset + length + 12);
    if (name === 'IDAT') data.push(chunk.subarray(8, -4));
    else if (name !== 'IEND') before.push(chunk);
    offset += length + 12;
  }
  return { before, raw: inflateSync(Buffer.concat(data)) };
}

// Перезапись только известного authored RGBA/Sub PNG; общий PNG consumer не меняется.
function neighborScanlines(source) {
  assert.equal(backdropHash(source), BACKDROP_FIXTURE.assets.A.sha256);
  assert.deepEqual(png(source), BACKDROP_FIXTURE.sourcePixels);
  assert.equal(source[24], 8);
  assert.equal(source[25], 6);
  assert.equal(source[28], 0);
  const { before, raw } = fixtureScanlines(source);
  const { width, height } = BACKDROP_FIXTURE.sourcePixels;
  const stride = width * 4 + 1;
  assert.equal(raw.length, stride * height);
  const rewritten = Buffer.alloc(raw.length);
  const rect = BACKDROP_FIXTURE.changedSourceRect;
  for (let y = 0; y < height; y++) {
    assert.equal(raw[y * stride], 1, 'authored source uses the Sub filter');
    for (let x = 0; x < width * 4; x++) {
      const offset = y * stride + 1 + x;
      rewritten[offset] = (raw[offset] + (x >= 4 ? rewritten[offset - 4] : 0)) & 255;
    }
    if (y >= rect.y && y < rect.y + rect.height)
      for (let x = rect.x; x < rect.x + rect.width; x++) {
        const offset = y * stride + 1 + x * 4;
        assert.equal(rewritten[offset + 3], 255, 'intervention lies in opaque source pixels');
        rewritten.set(BACKDROP_FIXTURE.replacementRgba, offset);
      }
  }
  return { before, raw: rewritten };
}

export function assertBackdropNeighbor(source, neighbor) {
  assert.deepEqual(png(neighbor), BACKDROP_FIXTURE.sourcePixels);
  const expected = neighborScanlines(source);
  const actual = fixtureScanlines(neighbor);
  assert.deepEqual(actual.before, expected.before, 'backdrop PNG metadata differs');
  assert.ok(
    actual.raw.equals(expected.raw),
    'backdrop B differs from the declared source intervention',
  );
}

export function createBackdropNeighbor(source) {
  const { before, raw } = neighborScanlines(source);
  const chunk = (name, bytes) => {
    const result = Buffer.alloc(bytes.length + 12);
    result.writeUInt32BE(bytes.length);
    result.write(name, 4, 'ascii');
    bytes.copy(result, 8);
    result.writeUInt32BE(crc32(result.subarray(4, -4)), result.length - 4);
    return result;
  };
  return Buffer.concat([
    source.subarray(0, 8),
    ...before,
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

let verifiedAssets;
export function backdropAssets() {
  if (verifiedAssets) return verifiedAssets;
  const result = {};
  for (const variant of ['A', 'B', ...ORDER_BACKDROPS]) {
    const asset = BACKDROP_FIXTURE.assets[variant];
    const bytes = readFileSync(new URL(asset.file, directory));
    assert.equal(backdropHash(bytes), asset.sha256, `backdrop ${variant} asset identity`);
    assert.deepEqual(png(bytes), BACKDROP_FIXTURE.sourcePixels);
    result[variant] = bytes;
    if (ORDER_BACKDROPS.includes(variant))
      assert.ok(
        fixtureScanlines(bytes).raw.equals(
          fixtureScanlines(createOrderBackdrop(variant, BACKDROP_FIXTURE.sourcePixels)).raw,
        ),
        `backdrop ${variant} pixels differ from the controlled input`,
      );
  }
  assertBackdropNeighbor(result.A, result.B);
  verifiedAssets = result;
  return result;
}

export function validateBackdropWitness(value, variant) {
  keys(value, [
    'schema',
    'variant',
    'fixtureSha256',
    'assetSha256',
    'sourcePixels',
    'image',
    'fit',
    'paints',
  ]);
  assert.equal(value.schema, BACKDROP_FIXTURE.schema);
  assert.equal(value.variant, variant);
  assert.equal(value.fixtureSha256, BACKDROP_FIXTURE_HASH);
  assert.equal(value.assetSha256, BACKDROP_FIXTURE.assets[variant].sha256);
  assert.deepEqual(value.sourcePixels, BACKDROP_FIXTURE.sourcePixels);
  keys(value.image, [
    'source',
    'bitmapPixels',
    'bounds',
    'stretch',
    'horizontalAlignment',
    'verticalAlignment',
  ]);
  assert.equal(value.image.source, `ms-appx:///Assets/${BACKDROP_FIXTURE.assets[variant].file}`);
  assert.equal(value.image.stretch, 'UniformToFill');
  assert.equal(value.image.horizontalAlignment, 'Stretch');
  assert.equal(value.image.verticalAlignment, 'Stretch');
  keys(value.image.bitmapPixels, ['width', 'height']);
  assert.ok(
    Number.isInteger(value.image.bitmapPixels.width) &&
      value.image.bitmapPixels.width >= 375 &&
      value.image.bitmapPixels.width <= value.sourcePixels.width,
  );
  assert.ok(
    Number.isInteger(value.image.bitmapPixels.height) &&
      value.image.bitmapPixels.height >= 812 &&
      value.image.bitmapPixels.height <= value.sourcePixels.height,
  );
  keys(value.image.bounds, ['x', 'y', 'width', 'height']);
  const bounds = value.image.bounds;
  assert.equal(bounds.x, 0);
  assert.equal(bounds.y, 0);
  assert.equal(bounds.width, 375);
  assert.ok(Number.isFinite(bounds.height) && bounds.height >= 812 && bounds.height <= 887);
  assert.deepEqual(value.fit, {
    scale: Math.max(
      bounds.width / value.sourcePixels.width,
      bounds.height / value.sourcePixels.height,
    ),
    offsetX: bounds.x,
    offsetY: bounds.y,
  });
  keys(value.paints, BACKDROP_PAINTS);
  for (const paint of Object.values(value.paints)) {
    keys(paint, ['rgba', 'opacity']);
    assert.equal(paint.rgba.length, 4);
    assert.ok(paint.rgba.every((code) => Number.isInteger(code) && code >= 0 && code <= 255));
    assert.ok(Number.isFinite(paint.opacity) && paint.opacity >= 0 && paint.opacity <= 1);
  }
  return value;
}

export function backdropProbeRegions(witness) {
  const { scale, offsetX, offsetY } = witness.fit;
  const source = BACKDROP_FIXTURE.changedSourceRect;
  const footprint = {
    x: offsetX + source.x * scale,
    y: offsetY + source.y * scale,
    width: source.width * scale,
    height: source.height * scale,
  };
  const left = Math.floor(footprint.x);
  const regions = {
    ghost: { x: left - 11, y: Math.ceil(footprint.y) + 16, width: 6, height: 8 },
    ghostFurther: { x: left - 41, y: Math.ceil(footprint.y) + 16, width: 6, height: 8 },
    body: { x: left - 11, y: Math.ceil(footprint.y + footprint.height) + 16, width: 6, height: 8 },
    bodyOpposite: {
      x: Math.ceil(footprint.x + footprint.width) + 16,
      y: Math.ceil(footprint.y + footprint.height) + 16,
      width: 6,
      height: 8,
    },
    control: { x: 20, y: 20, width: 335, height: 104 },
  };
  const margin = BACKDROP_FIXTURE.resamplingMargin;
  for (const region of Object.values(regions)) {
    assert.ok(
      region.x >= 0 &&
        region.y >= 0 &&
        region.x + region.width <= 375 &&
        region.y + region.height <= 812,
    );
    assert.ok(
      region.x + region.width <= footprint.x - margin ||
        region.x >= footprint.x + footprint.width + margin ||
        region.y + region.height <= footprint.y - margin ||
        region.y >= footprint.y + footprint.height + margin,
    );
  }
  assert.ok(regions.ghost.y + regions.ghost.height < 380);
  assert.ok(regions.body.y >= 438);
  assert.ok(regions.bodyOpposite.y >= 438);
  return { footprint, margin, ...regions };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv[2], 'generate', 'Usage: node sheet-backdrop-fixture.mjs generate');
  const output = createBackdropNeighbor(
    readFileSync(new URL(BACKDROP_FIXTURE.assets.A.file, directory)),
  );
  writeFileSync(new URL(BACKDROP_FIXTURE.assets.B.file, directory), output);
  const descriptor = structuredClone(BACKDROP_FIXTURE);
  descriptor.assets.B.sha256 = backdropHash(output);
  writeFileSync(descriptorUrl, serializeBackdropFixture(descriptor));
  process.stdout.write(`${descriptor.assets.B.sha256}\n`);
}
