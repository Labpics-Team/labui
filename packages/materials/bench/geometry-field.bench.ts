import { performance } from 'node:perf_hooks';
import { materialContour } from '../src/engine/contour';
import { __computeDisplacementField, __fieldStats } from '../src/engine/liquid-glass';
import type { RoundedShape } from '../src/engine/rounded-shape';

const cases: Array<{ name: string; w: number; h: number; shape: RoundedShape }> = [
  { name: 'circular', w: 320, h: 200, shape: 28 },
  { name: 'elliptical', w: 200, h: 150, shape: [60, 20, 0, 0, 0, 0, 0, 0] },
  { name: 'asymmetric', w: 320, h: 200, shape: [90, 30, 20, 70, 40, 40, 10, 15] },
  {
    name: 'smooth',
    w: 320,
    h: 200,
    shape: materialContour(320, 200, [90, 30, 20, 70, 40, 40, 10, 15], 0.6),
  },
];
const evict = () => {
  for (let i = 0; i < 5; i++) {
    __computeDisplacementField(17 + i, 12, 2, 4, 1);
    __computeDisplacementField(17 + i, 12, [2, 1, 0, 0, 0, 0, 0, 0], 4, 1);
  }
};
const median = (values: number[]) => values.sort((a, b) => a - b)[values.length >> 1];
const rows = cases.map(({ name, w, h, shape }) => {
  for (let i = 0; i < 4; i++) {
    evict();
    __computeDisplacementField(w, h, shape, 40, 2);
  }
  const cold: number[] = [];
  for (let i = 0; i < 9; i++) {
    evict();
    const start = performance.now();
    __computeDisplacementField(w, h, shape, 40, 2);
    cold.push(performance.now() - start);
  }
  const retained: number[] = [];
  for (let i = 0; i < 9; i++) {
    const start = performance.now();
    for (let j = 0; j < 100; j++) __computeDisplacementField(w, h, shape, 24 + (j % 5), 2);
    retained.push((performance.now() - start) / 100);
  }
  return { name, coldMs: median(cold), retainedMs: median(retained), stats: __fieldStats() };
});
process.stdout.write(
  JSON.stringify(
    { runtime: process.version, platform: process.platform, arch: process.arch, rows },
    null,
    2,
  ),
);
