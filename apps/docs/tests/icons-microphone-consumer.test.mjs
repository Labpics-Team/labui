import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import {
  MICROPHONE_ENTRIES, MICROPHONE_ICONS, assertMicrophonePaths, microphoneFixture,
  microphoneReference, microphoneTypeFixture, rawMicrophoneParts, validateMicrophoneReference,
} from './icons-microphone-consumer.mjs';
import { rawContentPath } from './icons-content-scale-consumer.mjs';
import { ICONS_HARNESS_FILES } from './icons-harness.mjs';
import { assertIconsImport, consumerFixture, consumerPublicEntries } from './icons-packed.mjs';
import { readAuthorMaster } from './prepare-icons-inputs.mjs';

const snapshot = JSON.parse(await readFile(new URL('./fixtures/icons-microphone-masters.json', import.meta.url)));
const pin = { figma: { fileKey: snapshot.manifest.source.fileKey, version: snapshot.manifest.source.version } };
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'lab-ui-microphone-oracle-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'semantics'), { recursive: true });
  await writeFile(join(root, 'semantics/figma-baseline.json'), JSON.stringify(snapshot.manifest));
  await writeFile(join(root, 'semantics/author-anatomy.json'), JSON.stringify(snapshot.semantic));
  for (const [file, bytes] of Object.entries(snapshot.masters)) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), bytes);
  }
  return { root, reference: await microphoneReference(root, pin, readAuthorMaster) };
}

// Достаточный healthy control: геометрическая нормализация raw contours без producer.
function narrowedPaths(reference, width) {
  const parts = rawMicrophoneParts(reference);
  const body = parts.find((part) => part.id === 'microphone-body');
  const contours = body.d.split(/(?=M)/).filter(Boolean).map(rawContentPath);
  const range = (contour) => {
    const xs = contour.flatMap((segment) => segment.points.map((point) => point[0]));
    return [Math.min(...xs), Math.max(...xs)];
  };
  const [outerLow, outerHigh] = range(contours[0]);
  body.d = contours.map((contour) => {
    const [low, high] = range(contour);
    const center = (low + high) / 2;
    const span = high - low - (outerHigh - outerLow) * (1 - width);
    return contour.map(({ command, points }) => command + points.flatMap(([x, y]) => [center + (x - center) * span / (high - low), y]).join(' ')).join('');
  }).join('');
  if (reference.declaration.composition) return [{ d: parts.map((part) => part.d).join(''), fillRule: 'evenodd' }];
  return parts.map(({ d, fillRule }) => ({ d, fillRule }));
}

test('four saved raw masters retain independently authored compound and layered anatomy', async (t) => {
  const { reference } = await fixture(t);
  for (const icon of MICROPHONE_ICONS)
    for (const variant of ['outline', 'filled']) {
      const source = reference.icons[icon][variant];
      assertMicrophonePaths(source.paths, source, 1);
      for (const width of [.9, .8]) assertMicrophonePaths(narrowedPaths(source, width), source, width);
    }
  assert.notDeepEqual(reference.icons.mic.outline.paths, reference.icons.mic.filled.paths);
  assert.notDeepEqual(reference.icons['mic-circle'].outline.paths, reference.icons['mic-circle'].filled.paths);
});

test('raw source receipts refuse edited masters and foreign declarations before producer import', async (t) => {
  const { root, reference } = await fixture(t);
  const invalid = structuredClone(reference);
  invalid.icons['mic-circle'].filled.declaration.parts[2].contourIndices = [1];
  assert.throws(() => validateMicrophoneReference(invalid, pin.figma));
  invalid.icons['mic-circle'].filled = structuredClone(reference.icons['mic-circle'].filled);
  invalid.icons.mic.filled.author.masterSha256 = 'a'.repeat(64);
  assert.throws(() => validateMicrophoneReference(invalid, pin.figma));
  const file = snapshot.manifest.icons.mic.outline.master;
  await writeFile(join(root, file), snapshot.masters[file].replace('M19.1299', 'M19.0299'));
  await assert.rejects(() => microphoneReference(root, pin, readAuthorMaster), /raw microphone master/);
});

test('oracle catches silent fallback, altered height, missing counter and jagged curves', async (t) => {
  const { reference } = await fixture(t);
  for (const icon of MICROPHONE_ICONS)
    for (const variant of ['outline', 'filled']) {
      const source = reference.icons[icon][variant];
      const healthy = narrowedPaths(source, .8);
      assertMicrophonePaths(healthy, source, .8);
      assert.throws(() => assertMicrophonePaths(source.paths, source, .8), /bodyWidth/);
      const bodyPath = source.declaration.parts.find((part) => part.id === 'microphone-body').pathIndex;
      const jagged = structuredClone(healthy);
      jagged[bodyPath].d = jagged[bodyPath].d.replace(/C([^A-Za-z]*)/g, (_, operands) => {
        const points = operands.trim().split(/[\s,]+/);
        return [0, 2, 4].map((index) => 'L' + points.slice(index, index + 2).join(' ')).join('');
      });
      assert.throws(() => assertMicrophonePaths(jagged, source, .8));
      const height = structuredClone(healthy);
      const bodyParts = rawMicrophoneParts({ ...source, paths: height });
      const changedBody = bodyParts.find((part) => part.id === 'microphone-body');
      const originalBody = changedBody.d;
      changedBody.d = changedBody.d.replace(/^M([-\d.]+) ([-\d.]+)/, (_, x, y) => `M${x} ${Number(y) + .01}`);
      height[bodyPath].d = height[bodyPath].d.replace(originalBody, changedBody.d);
      assert.throws(() => assertMicrophonePaths(height, source, .8), /высота/);
    }
  const compound = reference.icons['mic-circle'].filled;
  const missing = narrowedPaths(compound, .8);
  missing[0].d = missing[0].d.split(/(?=M)/).filter(Boolean).slice(0, 2).join('');
  assert.throws(() => assertMicrophonePaths(missing, compound, .8));
  const extra = narrowedPaths(compound, .8);
  extra[0].d += 'M10 10L11 10L10 11Z';
  assert.throws(() => assertMicrophonePaths(extra, compound, .8));
});

test('unchanged support, enclosure and paint are required for every supported variant', async (t) => {
  const { reference } = await fixture(t);
  for (const icon of MICROPHONE_ICONS)
    for (const variant of ['outline', 'filled']) {
      const source = reference.icons[icon][variant];
      const healthy = narrowedPaths(source, .9);
      const altered = structuredClone(healthy);
      altered[0].d = altered[0].d.replace(/^M([-\d.]+)/, (_, x) => `M${Number(x) + .01}`);
      assert.throws(() => assertMicrophonePaths(altered, source, .9), /стойка|обрамление/);
      const paint = structuredClone(healthy);
      paint[0].fillRule = paint[0].fillRule === 'evenodd' ? 'nonzero' : 'evenodd';
      assert.throws(() => assertMicrophonePaths(paint, source, .9));
    }
});

test('schema9 adds public microphones and preserves earlier packed fixtures', () => {
  const old = consumerPublicEntries(8);
  assert.deepEqual(consumerPublicEntries(9).filter((entry) => !old.includes(entry)), MICROPHONE_ENTRIES);
  for (const entry of MICROPHONE_ENTRIES) assertIconsImport(entry);
  assert.throws(() => assertIconsImport('@labpics/icons/variations/mic-off'));
  assert.throws(() => assertIconsImport('@labpics/icons/ir/author-capsule-runtime'));
  assert.equal(consumerFixture(8).includes('mountMicrophoneConsumer'), false);
  assert.ok(consumerFixture(9).includes(microphoneFixture()));
  assert.ok(ICONS_HARNESS_FILES.includes('apps/docs/tests/icons-microphone-consumer.mjs'));
  const types = microphoneTypeFixture();
  assert.ok(types.includes("variant:'filled',variation:{bodyWidth:.8}"));
  assert.equal((types.match(/@ts-expect-error/g) ?? []).length, 2);
});
