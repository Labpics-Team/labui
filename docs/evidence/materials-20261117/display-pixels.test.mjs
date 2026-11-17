import assert from 'node:assert/strict';
import test from 'node:test';
import { sampleDisplay } from './display-pixels.mjs';

const oldMarker = [7, 251, 137];
const nextMarker = [7, 129, 128];
function frame(marker, scale, value) {
  const width = 200 * scale;
  const height = 100 * scale;
  const pixels = new Uint8Array(width * height * 4).fill(value);
  for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
  for (let y = 16 * scale; y < 24 * scale; y++)
    for (let x = 16 * scale; x < 24 * scale; x++) pixels.set([...marker, 255], (y * width + x) * 4);
  return { width, height, pixels };
}

test('a previous scene cannot satisfy the next display-frame marker', () => {
  for (const scale of [1, 2, 3]) {
    const previous = frame(oldMarker, scale, 25);
    assert.deepEqual(sampleDisplay(previous, [50, 150], oldMarker), [
      [25, 25, 25, 255],
      [25, 25, 25, 255],
    ]);
    assert.throws(() => sampleDisplay(previous, [50, 150], nextMarker), /page marker appears/);
    assert.deepEqual(sampleDisplay(frame(nextMarker, scale, 255), [50, 150], nextMarker), [
      [255, 255, 255, 255],
      [255, 255, 255, 255],
    ]);
  }
});
