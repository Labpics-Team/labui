import assert from 'node:assert/strict';
import * as wireV1 from '@labpics/colors/program-wire/abi-v1.js';
import * as wireV3 from '@labpics/colors/program-wire/abi-v3.js';
import { test } from 'vitest';

import config from '../labui.config.json' with { type: 'json' };
import { prepareEngineConfig } from '../prepare-config.mjs';
import { compileTheme, projectTheme, themePropertyNames, withRoleOverrides } from '../program.mjs';
import { declaration, recorderAbi, unboundPresentations } from './runtime-support.mjs';

test('каждая terminal presentation имеет emission, включая opacity тона', () => {
  const abi = recorderAbi();
  const model = declaration();
  const compiled = compileTheme(abi, model, model.themes.light);
  const rows = abi.instances[0].rows;
  assert.deepEqual(unboundPresentations(rows), []);
  assert.equal(compiled.bindings.emissions.length, compiled.slots.size);
  assert.equal(compiled.bindings.presentations.length, compiled.counts.presentations);
  assert.equal(
    new Set(compiled.bindings.emissions.map(({ sinkOutput }) => sinkOutput)).size,
    compiled.slots.size,
  );
  const slots = new Set(compiled.bindings.emissions.map(({ slot }) => slot));
  for (const point of compiled.bindings.presentations) assert.ok(slots.has(point.slot));
  assert.ok([...compiled.slots.values()].some((names) => names.length === 0));
  assert.equal(
    compiled.counts.paints,
    rows.filter(([kind]) => ['solidPaint', 'opacityPaint'].includes(kind)).length,
  );
});

test('backgroundOpacity сохраняет физику слоя и отвергает нечисловой ввод', () => {
  assert.equal(prepareEngineConfig(config).themes.light.paints.get('bg-tone-1').opacity, 1);
  for (const alpha of [0, 0.5, 1]) {
    const changed = structuredClone(config);
    changed.themes.light.backgroundOpacity = alpha;
    assert.equal(prepareEngineConfig(changed).themes.light.paints.get('bg-tone-1').opacity, alpha);
  }
  for (const alpha of [null, '0.5', false, -0.1, 1.1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const changed = structuredClone(config);
    changed.themes.light.backgroundOpacity = alpha;
    assert.throws(() => prepareEngineConfig(changed), /ожидается число/u);
  }
});

test('CSS переносит straight alpha и отдельные готовые composites без вычисления', () => {
  const abi = recorderAbi();
  const model = declaration();
  const program = compileTheme(abi, model, model.themes.light);
  const points = [...program.slots].map(([slot]) => ({ slot, source: [10, 20, 30], opacity: 0.5 }));
  const composites = [...new Set([...program.composites.values()].map(({ root }) => root))].map(
    (root) => ({ root, scenario: 1, source: [210, 220, 230] }),
  );
  const result = projectTheme(program, model.themes.light, points, composites);
  assert.equal(result.vars.get('--lab-locked'), 'rgb(10 20 30 / 0.5)');
  assert.equal(result.vars.get('--lab-bg-tone-2'), 'rgb(210 220 230)');
  assert.deepEqual(result.paints.get('--lab-locked'), { rgb: [10, 20, 30], opacity: 0.5 });
  assert.equal(result.vars.get('--lab-label'), 'var(--lab-label-primary)');
  assert.equal(result.vars.size, themePropertyNames(model.themes.light).length);
  assert.throws(
    () => projectTheme(program, model.themes.light, points.slice(1), composites),
    /неполный/u,
  );
  assert.throws(
    () => projectTheme(program, model.themes.light, [...points, points[0]], composites),
    /повторный/u,
  );
  assert.throws(() => projectTheme(program, model.themes.light, points, []), /композицию/u);
  assert.throws(
    () =>
      projectTheme(
        program,
        model.themes.light,
        points,
        composites.map((point) => ({ ...point, scenario: 2 })),
      ),
    /композицию/u,
  );
});

test('inline alias становится отдельной fixed Paint без изменения исходного семейства', () => {
  const original = declaration();
  const originalSelected = original.themes.light;
  const { model, selected } = withRoleOverrides(original, originalSelected, [
    { name: 'label', source: [1, 2, 3], opacity: 0.5 },
  ]);
  assert.equal(selected.aliases.has('label'), false);
  const paint = selected.paints.get('label');
  assert.deepEqual(model.sources[paint.source], [1, 2, 3]);
  assert.equal(paint.opacity, 0.5);
  assert.deepEqual(
    selected.paints.get('label-primary'),
    originalSelected.paints.get('label-primary'),
  );
  assert.equal(selected.constraints, originalSelected.constraints);
  assert.equal(originalSelected.aliases.get('label'), 'label-primary');
  assert.equal(originalSelected.paints.has('label'), false);
  const abi = recorderAbi();
  const compiled = compileTheme(abi, model, selected);
  const rows = abi.instances[0].rows;
  const sourceId = rows.find(
    ([kind, , rgb]) => kind === 'source' && rgb === model.sources[paint.source],
  )[1];
  assert.ok(rows.some(([kind, , input]) => kind === 'fixedTarget' && input === sourceId));
  assert.deepEqual(unboundPresentations(rows), []);
  assert.deepEqual(
    themePropertyNames(selected).sort(),
    themePropertyNames(originalSelected).sort(),
  );
  const restored = withRoleOverrides(original, originalSelected, []);
  assert.equal(restored.selected, originalSelected);
  assert.equal(restored.model, original);
});

test('inline composite становится Paint и не сохраняет старую скрытую композицию', () => {
  const original = declaration();
  const { model, selected } = withRoleOverrides(original, original.themes.light, [
    { name: 'bg-tone-2', source: [20, 30, 40], opacity: 0.25 },
  ]);
  const abi = recorderAbi();
  const compiled = compileTheme(abi, model, selected);
  assert.equal(compiled.composites.has('bg-tone-2'), false);
  assert.equal(compiled.composites.has('bg-tone-3'), true);
  assert.deepEqual(selected.constraints, original.themes.light.constraints);
  const points = [...compiled.slots].map(([slot]) => ({
    slot,
    source: [20, 30, 40],
    opacity: 0.25,
  }));
  const composites = [...compiled.composites.values()].map(({ root }) => ({
    root,
    scenario: 1,
    source: [200, 210, 220],
  }));
  const projected = projectTheme(compiled, selected, points, composites);
  assert.equal(projected.vars.get('--lab-bg-tone-2'), 'rgb(20 30 40 / 0.25)');
  assert.equal(projected.vars.get('--lab-bg-tone-3'), 'rgb(200 210 220)');
});

test('inline ingress отвергает неизвестную роль, дубликат и невалидную Paint', () => {
  const model = declaration();
  for (const overrides of [
    [{ name: 'unknown', source: [1, 2, 3], opacity: 1 }],
    [
      { name: 'label', source: [1, 2, 3], opacity: 1 },
      { name: 'label', source: [4, 5, 6], opacity: 1 },
    ],
    [{ name: 'label', source: [1.5, 2, 3], opacity: 1 }],
    [{ name: 'label', source: [1, 2, 3], opacity: 1.1 }],
  ])
    assert.throws(() => withRoleOverrides(model, model.themes.light, overrides));
});

function publicEncoding(model, selected) {
  const calls = { computed: 0, assignments: 0 };
  class TracedAssignmentBuilder extends wireV3.ProgramWireBuilderV3 {
    computedTarget(...args) {
      ++calls.computed;
      return super.computedTarget(...args);
    }
    assignment(...args) {
      ++calls.assignments;
      return super.assignment(...args);
    }
  }
  const { wire } = compileTheme(
    { ...wireV1, ...wireV3, ProgramWireBuilderV3: TracedAssignmentBuilder },
    model,
    selected,
  );
  const version = new DataView(wire.buffer, wire.byteOffset, wire.byteLength).getUint16(4, true);
  return { calls, version, wire };
}

test('sole-computed override не создаёт V3 без assignment; удаление восстанавливает исходный wire', () => {
  const ordinary = prepareEngineConfig(config);
  assert.deepEqual(publicEncoding(ordinary, ordinary.themes.light).calls, {
    computed: 0,
    assignments: 0,
  });
  assert.equal(publicEncoding(ordinary, ordinary.themes.light).version, 1);
  const original = prepareEngineConfig(config, 'more');
  const selected = original.themes.light;
  const adaptive = publicEncoding(original, selected);
  assert.equal(adaptive.version, 3);
  assert.deepEqual(adaptive.calls, { computed: 1, assignments: 1 });
  const changed = withRoleOverrides(original, selected, [
    { name: 'badge-fill-brand', source: [1, 2, 3], opacity: 1 },
  ]);
  // Объявленная возможность остаётся для восстановления, но больше не является целью.
  assert.equal(changed.selected.computed.size, 1);
  const fixed = publicEncoding(changed.model, changed.selected);
  assert.equal(fixed.version, 1);
  assert.deepEqual(fixed.calls, { computed: 0, assignments: 0 });
  const other = withRoleOverrides(original, selected, [
    { name: 'label-primary', source: [1, 2, 3], opacity: 1 },
  ]);
  assert.equal(publicEncoding(other.model, other.selected).version, 3);
  assert.deepEqual(publicEncoding(other.model, other.selected).calls, {
    computed: 1,
    assignments: 1,
  });
  const restored = withRoleOverrides(original, selected, []);
  assert.deepEqual(publicEncoding(restored.model, restored.selected).wire, adaptive.wire);
});

test('computed tone source входит в ту же assignment, даже когда другие Paint фиксированы', () => {
  const model = declaration();
  model.sources['tone-only'] = [128, 128, 128];
  model.themes.light.tone.source = 'tone-only';
  model.themes.light.computed.set('tone-only', {
    domain: { kind: 'box', lower: [0, 0, 0], upper: [255, 255, 255] },
    maxDelta: 0,
  });
  const encoded = publicEncoding(model, model.themes.light);
  assert.equal(encoded.version, 3);
  assert.deepEqual(encoded.calls, { computed: 1, assignments: 1 });
});
