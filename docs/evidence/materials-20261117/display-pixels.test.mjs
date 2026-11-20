import assert from 'node:assert/strict';
import test from 'node:test';
import { sampleDisplay } from './display-pixels.mjs';

const oldMarker = [7, 251, 137];
const nextMarker = [7, 129, 128];
function frame(
  marker,
  scale,
  value,
  samples,
  points = samples.map((_, i) => ({ x: 50 + i * 100, y: 50 })),
) {
  const width = 200 * scale;
  const height = 100 * scale;
  const pixels = new Uint8Array(width * height * 4).fill(value);
  for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
  for (let y = 16 * scale; y < 24 * scale; y++)
    for (let x = 16 * scale; x < 24 * scale; x++) pixels.set([...marker, 255], (y * width + x) * 4);
  for (const [index, sample] of samples.entries()) {
    const sampleX = points[index].x * scale;
    for (let y = points[index].y * scale; y < (points[index].y + 1) * scale; y++)
      for (let x = sampleX; x < sampleX + scale; x++) pixels.set(sample, (y * width + x) * 4);
  }
  return { width, height, pixels };
}

test('a previous scene cannot satisfy the next display-frame marker', () => {
  for (const scale of [1, 2, 3]) {
    const previousSamples = [
      [201, 23, 55, 255],
      [12, 144, 236, 255],
    ];
    const nextSamples = [
      [73, 219, 16, 255],
      [151, 62, 193, 255],
    ];
    const previous = frame(oldMarker, scale, 25, previousSamples);
    assert.deepEqual(sampleDisplay(previous, [50, 150], oldMarker), previousSamples);
    assert.throws(() => sampleDisplay(previous, [50, 150], nextMarker), /page marker appears/);
    assert.deepEqual(
      sampleDisplay(frame(nextMarker, scale, 255, nextSamples), [50, 150], nextMarker),
      nextSamples,
    );
  }
});

test('component samples retain their own x and y at every screen scale', () => {
  const points = [
    { x: 33, y: 28 },
    { x: 120, y: 70 },
  ];
  const pixels = [
    [21, 92, 103, 255],
    [184, 76, 13, 255],
  ];
  for (const scale of [1, 2, 3]) {
    const display = frame(nextMarker, scale, 0, pixels, points);
    assert.deepEqual(sampleDisplay(display, points, nextMarker), pixels);
    assert.throws(
      () => sampleDisplay(display, [{ x: -1, y: 28 }], nextMarker),
      /within the display/,
    );
    assert.throws(
      () => sampleDisplay(display, [{ x: 33, y: -1 }], nextMarker),
      /within the display/,
    );
  }
});
