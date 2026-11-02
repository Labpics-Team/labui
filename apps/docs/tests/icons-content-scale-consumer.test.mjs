import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ANNULUS_ICONS } from './icons-annulus-consumer.mjs';
import {
  CONTENT_SCALE_ENTRIES,
  assertContentMotionTransfer,
  assertContentScalePaths,
  contentScaleFixture,
  contentScaleTypeFixture,
  rawContentCoordinates,
} from './icons-content-scale-consumer.mjs';
import { ICONS_HARNESS_FILES } from './icons-harness.mjs';
import { assertIconsImport, consumerFixture, consumerPublicEntries } from './icons-packed.mjs';
import { readAuthorMaster } from './prepare-icons-inputs.mjs';

const snapshot = JSON.parse(
  await readFile(new URL('./fixtures/icons-annulus-masters.json', import.meta.url)),
);
const reference = (icon) =>
  readAuthorMaster(Buffer.from(snapshot.masters[snapshot.manifest.icons[icon].outline.master]));

test('raw oracle normalizes H/V coordinates without losing closed contours', () => {
  assert.deepEqual(rawContentCoordinates('M2 3H7V9L2 9Z M10 11C12 13 14 15 16 17Z'), [
    [2, 3],
    [7, 3],
    [7, 9],
    [2, 9],
    [10, 11],
    [12, 13],
    [14, 15],
    [16, 17],
  ]);
  assert.deepEqual(rawContentCoordinates('M2 3 7 9Z'), [
    [2, 3],
    [7, 9],
  ]);
  for (const malformed of ['M2 3A1 1 0 0 0 5 6Z', 'm2 3l4 5z', 'M2 3HNaNZ', 'M2 3C4 5Z', 'M2 3@Z'])
    assert.throws(() => rawContentCoordinates(malformed));
});

test('all eight raw author masters provide an independent exact default oracle', () => {
  for (const icon of ANNULUS_ICONS) {
    const source = reference(icon);
    assertContentScalePaths(source.paths, source, { contentScale: 1, enclosureEmphasis: 1 });
    for (const part of source.paths.slice(0, -1))
      assert.ok(rawContentCoordinates(part.d).length > 0);
  }
});

test('silent source fallback fails the nondefault content oracle', () => {
  const source = reference('plus-circle');
  assert.throws(
    () =>
      assertContentScalePaths(source.paths, source, { contentScale: 0.9, enclosureEmphasis: 1 }),
    /content/,
  );
  assert.throws(() =>
    assertContentScalePaths(source.paths, source, { contentScale: 1, enclosureEmphasis: 1.1 }),
  );
});

test('outer replacement and changed paint cannot pass even at identity', () => {
  const source = reference('plus-circle');
  const altered = structuredClone(source.paths);
  altered.at(-1).d = altered.at(-1).d.replace('M12', 'M11');
  assert.throws(
    () => assertContentScalePaths(altered, source, { contentScale: 1, enclosureEmphasis: 1 }),
    /outer/,
  );
  const paint = structuredClone(source.paths);
  paint[0].fillRule = 'evenodd';
  assert.throws(() =>
    assertContentScalePaths(paint, source, { contentScale: 1, enclosureEmphasis: 1 }),
  );
});

test('opt-in imports add only the intended public families and preserve schema7', () => {
  const old = consumerPublicEntries(7);
  const next = consumerPublicEntries(8);
  assert.deepEqual(
    next.filter((entry) => !old.includes(entry)),
    CONTENT_SCALE_ENTRIES,
  );
  for (const entry of CONTENT_SCALE_ENTRIES) assertIconsImport(entry);
  assert.throws(() => assertIconsImport('@labpics/icons/content-variations/time'));
  assert.throws(() => assertIconsImport('@labpics/icons/ir/content-geometry-runtime'));
  assert.equal(consumerFixture(7).includes('mountContentScaleConsumer'), false);
  assert.equal(consumerFixture(8).includes(contentScaleFixture()), true);
  assert.equal(
    ICONS_HARNESS_FILES.includes('apps/docs/tests/icons-content-scale-consumer.mjs'),
    true,
  );
});

test('new type consumer has positive joint requests and exact independent Filled refusal', () => {
  const fixture = contentScaleTypeFixture();
  assert.ok(fixture.includes('contentScale:.9,enclosureEmphasis:1.1'));
  assert.ok(fixture.includes("variant:'filled'"));
  assert.equal((fixture.match(/@ts-expect-error/g) ?? []).length, 2);
});

test('reduced motion reaches target while normal interruption preserves the visible pose', () => {
  const instantaneous = { before: [0, 0], after: [1, 1], effect: { options: { duration: 0 } } };
  assertContentMotionTransfer(instantaneous, 'reduce', 1);
  assert.throws(() => assertContentMotionTransfer(instantaneous, 'no-preference', 1));
  const continued = {
    before: [0.4, 0.4],
    after: [0.4, 0.4],
    effect: { options: { duration: 1000 } },
  };
  assertContentMotionTransfer(continued, 'no-preference', 1);
  assert.throws(() => assertContentMotionTransfer(continued, 'reduce', 1));
  assert.throws(() =>
    assertContentMotionTransfer({ ...instantaneous, after: [0, 0] }, 'reduce', 1),
  );
});
