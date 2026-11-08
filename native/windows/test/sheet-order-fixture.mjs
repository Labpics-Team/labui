import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';
import { serializeBackdropFixture } from './sheet-fixture-descriptor.mjs';

export const ORDER_BACKDROPS = Object.freeze([
  'OrderBlack',
  'OrderWhite',
  'OrderGray',
  'OrderStripes',
]);

/** A 16-DIP stripe at the 375-DIP reference width. Flat controls pass through
 * the same native paints, blur and noise; none is an expected renderer image. */
export function createOrderBackdrop(variant, { width, height }) {
  assert.ok(ORDER_BACKDROPS.includes(variant));
  assert.ok(Number.isInteger(width) && width >= 375);
  assert.ok(Number.isInteger(height) && height >= 812);
  const row = Buffer.alloc(width * 4 + 1);
  for (let x = 0; x < width; x++) {
    const value =
      variant === 'OrderStripes'
        ? (Math.floor(((x + 0.5) * 375) / width / 16) % 2) * 255
        : { OrderBlack: 0, OrderWhite: 255, OrderGray: 128 }[variant];
    row.set([value, value, value, 255], 1 + x * 4);
  }
  const pixels = Buffer.alloc(row.length * height);
  for (let y = 0; y < height; y++) row.copy(pixels, y * row.length);
  const chunk = (name, bytes) => {
    const result = Buffer.alloc(bytes.length + 12);
    result.writeUInt32BE(bytes.length);
    result.write(name, 4, 'ascii');
    bytes.copy(result, 8);
    result.writeUInt32BE(crc32(result.subarray(4, -4)), result.length - 4);
    return result;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv[2], 'generate', 'Usage: node sheet-order-fixture.mjs generate');
  const directory = new URL('../../../examples/windows/Assets/', import.meta.url);
  const descriptorUrl = new URL('SheetBackdropWitness.json', directory);
  const descriptor = JSON.parse(readFileSync(descriptorUrl));
  for (const variant of ORDER_BACKDROPS) {
    const bytes = createOrderBackdrop(variant, descriptor.sourcePixels);
    const file = `SheetBackdrop${variant}.png`;
    writeFileSync(new URL(file, directory), bytes);
    descriptor.assets[variant] = { file, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
  writeFileSync(descriptorUrl, serializeBackdropFixture(descriptor));
}
