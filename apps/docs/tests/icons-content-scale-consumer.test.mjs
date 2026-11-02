import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ANNULUS_ICONS, rawAnnulusReference } from './icons-annulus-consumer.mjs';
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

function scaledAuthorPath(d, center, scale) {
  return d.replace(/([MLHVCQZ])([^MLHVCQZ]*)/g, (_, command, operands) => {
    let operandIndex = 0;
    return (
      command +
      operands.replace(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g, (value) => {
        const axis = command === 'H' ? 0 : command === 'V' ? 1 : operandIndex++ % 2;
        return String(center[axis] + scale * (Number(value) - center[axis]));
      })
    );
  });
}

function scaledAuthorContent(source, contentScale) {
  const [left, top, width, height] = source.viewBox;
  const center = [left + width / 2, top + height / 2];
  return source.paths.map((part, index) => ({
    ...part,
    d: index === source.paths.length - 1 ? part.d : scaledAuthorPath(part.d, center, contentScale),
  }));
}

function normalizedAxisLines(d) {
  let current = [0, 0];
  let start;
  return d.replace(/([MLHVCQZ])([^MLHVCQZ]*)/g, (segment, command, operands) => {
    const values = (operands.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) ?? []).map(
      Number,
    );
    if (command === 'Z') current = start;
    else if (command === 'H') {
      current = [values[0], current[1]];
      return `L${current.join(' ')}`;
    } else if (command === 'V') {
      current = [current[0], values[0]];
      return `L${current.join(' ')}`;
    } else {
      current = values.slice(-2);
      if (command === 'M') start = values.slice(0, 2);
    }
    return segment;
  });
}

// Проекция намеренно не проверяет контуры: она фиксирует одинаковые координаты у подмены.
function coordinateProjection(d) {
  const values = (
    normalizedAxisLines(d).match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) ?? []
  ).map(Number);
  assert.equal(values.length % 2, 0);
  return Array.from({ length: values.length / 2 }, (_, index) =>
    values.slice(2 * index, 2 * index + 2),
  );
}

function polyline(d) {
  return (
    rawContentCoordinates(d)
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.join(' ')}`)
      .join('') + 'Z'
  );
}

test('raw coordinate oracle normalizes H/V coordinates and implicit lines', () => {
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

test('equal scaled coordinates cannot replace authored curves with a jagged polyline', () => {
  const source = reference('question-circle');
  const parameters = { contentScale: 0.9, enclosureEmphasis: 1 };
  const healthy = scaledAuthorContent(source, parameters.contentScale);
  assertContentScalePaths(healthy, source, parameters);

  const jagged = structuredClone(healthy);
  const points = rawContentCoordinates(healthy[0].d);
  jagged[0].d = polyline(healthy[0].d);
  assert.deepEqual(rawContentCoordinates(jagged[0].d), points);
  assert.throws(() => assertContentScalePaths(jagged, source, parameters));
});

test('every author content path keeps curves and closure across nondefault scales', () => {
  for (const icon of ANNULUS_ICONS)
    for (const contentScale of [0.9, 1.1]) {
      const source = reference(icon);
      const parameters = { contentScale, enclosureEmphasis: 1 };
      const healthy = scaledAuthorContent(source, contentScale);
      assertContentScalePaths(healthy, source, parameters);
      for (let index = 0; index < healthy.length - 1; index++) {
        const sourcePoints = rawContentCoordinates(healthy[index].d);
        for (const [name, mutate] of [
          ['curve replaced by lines', polyline],
          ['closure removed', (d) => d.replace(/Z/g, '')],
        ]) {
          const changed = structuredClone(healthy);
          changed[index].d = mutate(changed[index].d);
          assert.notEqual(changed[index].d, healthy[index].d);
          assert.deepEqual(coordinateProjection(changed[index].d), sourcePoints);
          assert.throws(
            () => assertContentScalePaths(changed, source, parameters),
            undefined,
            `${icon}/${index} scale ${contentScale}: ${name}`,
          );
        }
      }
    }
});

test('H/V normalization to L preserves the permitted content geometry', () => {
  for (const icon of ANNULUS_ICONS) {
    const source = reference(icon);
    const parameters = { contentScale: 0.9, enclosureEmphasis: 1 };
    const healthy = scaledAuthorContent(source, parameters.contentScale);
    for (const part of healthy.slice(0, -1)) {
      const points = rawContentCoordinates(part.d);
      part.d = normalizedAxisLines(part.d);
      assert.deepEqual(rawContentCoordinates(part.d), points);
      assert.equal(/[HV]/.test(part.d), false);
    }
    assertContentScalePaths(healthy, source, parameters);
  }
});

test('a content line cannot become a new contour with the same coordinates', () => {
  const source = reference('question-circle');
  const parameters = { contentScale: 0.9, enclosureEmphasis: 1 };
  const healthy = scaledAuthorContent(source, parameters.contentScale);
  assertContentScalePaths(healthy, source, parameters);
  const changed = structuredClone(healthy);
  changed[1].d = changed[1].d.replace('L', 'M');
  assert.notEqual(changed[1].d, healthy[1].d);
  assert.deepEqual(coordinateProjection(changed[1].d), rawContentCoordinates(healthy[1].d));
  assert.throws(() => assertContentScalePaths(changed, source, parameters));
});

test('separate authored content contours cannot be joined with the same coordinates', () => {
  const source = reference('question-circle');
  source.paths[0].d += source.paths[1].d;
  source.paths.splice(1, 1);
  const parameters = { contentScale: 0.9, enclosureEmphasis: 1 };
  const healthy = scaledAuthorContent(source, parameters.contentScale);
  assertContentScalePaths(healthy, source, parameters);
  const changed = structuredClone(healthy);
  changed[0].d = changed[0].d.replace('ZM', 'ZL');
  assert.notEqual(changed[0].d, healthy[0].d);
  assert.deepEqual(coordinateProjection(changed[0].d), rawContentCoordinates(healthy[0].d));
  assert.throws(() => assertContentScalePaths(changed, source, parameters));
});

test('quadratic controls cannot become line vertices with the same coordinates', () => {
  const source = reference('question-circle');
  source.paths[0].d = 'M10 8Q14 8 14 12L12 14Z';
  const parameters = { contentScale: 0.9, enclosureEmphasis: 1 };
  const healthy = scaledAuthorContent(source, parameters.contentScale);
  assertContentScalePaths(healthy, source, parameters);
  const changed = structuredClone(healthy);
  changed[0].d = polyline(healthy[0].d);
  assert.deepEqual(rawContentCoordinates(changed[0].d), rawContentCoordinates(healthy[0].d));
  assert.throws(() => assertContentScalePaths(changed, source, parameters));
});

test('a scaled enclosure preserves its inner curve and exactly two closed contours', () => {
  const source = reference('plus-circle');
  const parameters = { contentScale: 1, enclosureEmphasis: 1.1 };
  const ring = rawAnnulusReference(source.paths, source.viewBox);
  const scale =
    (ring.outerRadius - parameters.enclosureEmphasis * ring.referenceThickness) / ring.innerRadius;
  const inner = scaledAuthorPath(ring.innerD, ring.center, scale);
  const healthy = structuredClone(source.paths);
  healthy.at(-1).d = ring.outerD + inner;
  assertContentScalePaths(healthy, source, parameters);

  for (const [name, mutate] of [
    ['inner curve replaced by lines', polyline],
    ['inner closure removed', (d) => d.replace(/Z/g, '')],
  ]) {
    const changed = structuredClone(healthy);
    const changedInner = mutate(inner);
    assert.deepEqual(coordinateProjection(changedInner), rawContentCoordinates(inner));
    changed.at(-1).d = ring.outerD + changedInner;
    assert.throws(() => assertContentScalePaths(changed, source, parameters), undefined, name);
  }

  const extraContour = structuredClone(healthy);
  extraContour.at(-1).d += 'M12 12L13 12L12 13Z';
  assert.throws(() => assertContentScalePaths(extraContour, source, parameters));
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
