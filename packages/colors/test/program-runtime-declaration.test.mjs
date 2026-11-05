import assert from 'node:assert/strict';
import { test } from 'vitest';

import config from '../labui.config.json' with { type: 'json' };
import { prepareEngineConfig } from '../prepare-config.mjs';
import { compileTheme, projectTheme, themePropertyNames } from '../program.mjs';
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
