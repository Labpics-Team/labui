import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  assertConsumerModuleGraph,
  assertIconsImport,
  assertPublicEntryModules,
  consumerFixture,
  consumerPublicEntries,
} from './icons-packed.mjs';

async function resolvedFixture(layout) {
  const parent = await realpath(tmpdir());
  const root = await mkdtemp(join(parent, 'labui-icons-exports-'));
  try {
    const expected = {};
    const specifiers = [
      '@labpics/ui-core/button',
      '@labpics/icons/symbols/reload',
      '@labpics/motion',
    ];
    for (const [specifier, name, key, target] of [
      [specifiers[0], '@labpics/ui-core', './button', layout.button],
      [specifiers[1], '@labpics/icons', './symbols/reload', layout.reload],
      [specifiers[2], '@labpics/motion', '.', layout.motion],
    ]) {
      const packageRoot = join(root, 'node_modules', name);
      const file = join(packageRoot, target);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, 'export const marker = true;\n');
      await writeFile(
        join(packageRoot, 'package.json'),
        JSON.stringify({
          name,
          type: 'module',
          exports: { [key]: { import: `./${target}`, require: './wrong.cjs' } },
        }),
      );
      expected[specifier] = file;
    }
    const resolver = join(root, 'resolve.mjs');
    await writeFile(
      resolver,
      `console.log(JSON.stringify(Object.fromEntries(${JSON.stringify(specifiers)}.map(specifier => [specifier, import.meta.resolve(specifier)]))));\n`,
    );
    const urls = JSON.parse(
      execFileSync(process.execPath, [resolver], { cwd: root, encoding: 'utf8', timeout: 10_000 }),
    );
    const entries = Object.fromEntries(
      Object.entries(urls).map(([specifier, url]) => [specifier, fileURLToPath(url)]),
    );
    assert.deepEqual(entries, expected);
    return {
      root,
      entries,
      relativeEntries: Object.values(entries).map((id) => relative(root, id).replaceAll('\\', '/')),
    };
  } finally {
    const target = await realpath(root);
    assert.equal(dirname(target), parent);
    assert.ok(basename(target).startsWith('labui-icons-exports-'));
    await rm(target, { recursive: true, force: true });
  }
}

test('installed public exports qualify after a lawful package-layout relocation', async () => {
  const baseline = await resolvedFixture({
    button: 'dist/components/button/index.js',
    reload: 'dist/symbols/reload.js',
    motion: 'dist/index.js',
  });
  const relocated = await resolvedFixture({
    button: 'published/button.mjs',
    reload: 'compiled/reload.mjs',
    motion: 'runtime/native.mjs',
  });
  for (const fixture of [baseline, relocated])
    assertPublicEntryModules(new Set(Object.values(fixture.entries)), fixture.entries, new Map());
  assert.equal(
    baseline.relativeEntries.some((id) =>
      id.endsWith('node_modules/@labpics/ui-core/dist/components/button/index.js'),
    ),
    true,
  );
  assert.equal(
    relocated.relativeEntries.some((id) =>
      id.endsWith('node_modules/@labpics/ui-core/dist/components/button/index.js'),
    ),
    false,
  );
  assert.equal(
    relocated.relativeEntries.some((id) =>
      id.endsWith('node_modules/@labpics/icons/dist/symbols/reload.js'),
    ),
    false,
  );
});

test('the complete production graph gate permits nested, module and renamed public implementations', async () => {
  for (const reload of [
    'dist/symbols/reload/index.js',
    'dist/symbols/reload.mjs',
    'semantics/reload.mjs',
  ]) {
    const { root, entries } = await resolvedFixture({
      button: 'published/button.mjs',
      reload,
      motion: 'runtime/native.mjs',
    });
    const graph = assertConsumerModuleGraph(
      root,
      new Set(Object.values(entries)),
      entries,
      new Map(),
    );
    assert.equal(graph.length, 3);
    assert.ok(graph.some((id) => id.endsWith(reload)));
  }
});

test('the complete production graph gate retains entry contribution and consumer containment refusals', async () => {
  const { root, entries } = await resolvedFixture({
    button: 'button.mjs',
    reload: 'reload.mjs',
    motion: 'motion.mjs',
  });
  const modules = new Set(Object.values(entries));
  modules.delete(entries['@labpics/icons/symbols/reload']);
  assert.throws(
    () => assertConsumerModuleGraph(root, modules, entries, new Map()),
    /symbols\/reload/,
  );
  modules.add(entries['@labpics/icons/symbols/reload']);
  modules.add(join(dirname(root), 'producer/private.mjs'));
  assert.throws(
    () => assertConsumerModuleGraph(root, modules, entries, new Map()),
    /consumer импортирует producer/,
  );
});

test('tree-shaken public facades qualify through the complete graph gate and retained dependencies', async () => {
  const { root, entries } = await resolvedFixture({
    button: 'button.mjs',
    reload: 'reload.mjs',
    motion: 'motion.mjs',
  });
  const imports = new Map(Object.values(entries).map((id) => [id, [`${id}:implementation`]]));
  const modules = new Set([...imports.values()].flat());
  assertConsumerModuleGraph(root, modules, entries, imports);
  modules.delete(`${entries['@labpics/icons/symbols/reload']}:implementation`);
  assert.throws(
    () => assertConsumerModuleGraph(root, modules, entries, imports),
    /symbols\/reload/,
  );
});

test('a missing or noncontributing desired entry cannot be replaced by a wrong symbol', async () => {
  const { entries } = await resolvedFixture({
    button: 'button.mjs',
    reload: 'reload.mjs',
    motion: 'motion.mjs',
  });
  const modules = new Set(Object.values(entries));
  modules.delete(entries['@labpics/icons/symbols/reload']);
  modules.add(entries['@labpics/icons/symbols/reload'].replace('reload', 'arrow'));
  assert.throws(() => assertPublicEntryModules(modules, entries, new Map()), /symbols\/reload/);
  assert.throws(
    () =>
      assertPublicEntryModules(
        new Set(Object.values(entries)),
        { ...entries, '@labpics/icons/symbols/reload': undefined },
        new Map(),
      ),
    /entry не разрешён/,
  );
});

test('wrong public symbols and whole catalogs refuse at the complete graph gate independently of placement', async () => {
  const { root, entries } = await resolvedFixture({
    button: 'button.mjs',
    reload: 'reload.mjs',
    motion: 'motion.mjs',
  });
  const modules = new Set(Object.values(entries));
  for (const specifier of [
    '@labpics/icons/symbols/arrow',
    '@labpics/icons/ir',
    '@labpics/icons/ir/recipes',
    '@labpics/icons/ir/candidates',
    '@labpics/icons',
    '@labpics/icons/authoring',
    '@labpics/icons/states/other-group',
  ]) {
    assert.throws(() => assertIconsImport(specifier), /чужой symbol или whole catalog/);
    assert.throws(
      () => assertConsumerModuleGraph(root, modules, entries, new Map(), [specifier]),
      /чужой symbol или whole catalog/,
    );
  }
  for (const specifier of [
    '@labpics/icons/symbols/reload',
    '@labpics/icons/ir/render',
    '@labpics/icons/motion',
    '@labpics/icons/states/status-circle',
    '@labpics/icons/states/expression-face',
    '@labpics/ui-core/button',
    './shared.mjs',
  ]) {
    assert.doesNotThrow(() => assertIconsImport(specifier));
    assert.doesNotThrow(() =>
      assertConsumerModuleGraph(root, modules, entries, new Map(), [specifier]),
    );
  }
});

test('state consumer requires the resolved group contribution without fixing its private layout', async () => {
  const { root, entries } = await resolvedFixture({
    button: 'published/button.mjs',
    reload: 'semantics/reload.mjs',
    motion: 'runtime/motion.mjs',
  });
  const source = '@labpics/icons/states/status-circle';
  const entry = join(root, 'node_modules/@labpics/icons/compiled/status.mjs');
  const stateEntries = { ...entries, [source]: entry };
  const required = [...Object.keys(entries), source];
  const imports = new Map([[entry, [`${entry}:implementation`]]]);
  const modules = new Set([...Object.values(entries), `${entry}:implementation`]);
  assert.doesNotThrow(() =>
    assertConsumerModuleGraph(root, modules, stateEntries, imports, [source], required),
  );
  modules.delete(`${entry}:implementation`);
  assert.throws(
    () => assertConsumerModuleGraph(root, modules, stateEntries, imports, [source], required),
    /states\/status-circle/,
  );
  assert.throws(
    () =>
      assertConsumerModuleGraph(
        root,
        new Set(Object.values(entries)),
        entries,
        imports,
        [source],
        required,
      ),
    /entry не разрешён/,
  );
});

test('schema3 requires both sliced state imports and one generic state executor', async () => {
  const { root, entries } = await resolvedFixture({
    button: 'button.mjs',
    reload: 'reload.mjs',
    motion: 'motion.mjs',
  });
  const imports = new Map();
  const modules = new Set(Object.values(entries));
  for (const group of ['status-circle', 'expression-face']) {
    const source = `@labpics/icons/states/${group}`;
    const entry = join(root, `node_modules/@labpics/icons/compiled/${group}.mjs`);
    entries[source] = entry;
    imports.set(entry, [`${entry}:implementation`]);
    modules.add(`${entry}:implementation`);
  }
  const required = consumerPublicEntries(3);
  assert.equal(required.length, 5);
  assertConsumerModuleGraph(root, modules, entries, imports, required, required);
  modules.delete(`${entries['@labpics/icons/states/expression-face']}:implementation`);
  assert.throws(
    () => assertConsumerModuleGraph(root, modules, entries, imports, required, required),
    /states\/expression-face/,
  );
  assert.deepEqual(consumerPublicEntries(2), required.slice(0, -1));
  assert.deepEqual(consumerPublicEntries(1), required.slice(0, -2));
  for (const schema of [2, 3]) {
    const fixture = consumerFixture(schema);
    assert.equal(fixture.split('function changeState(').length - 1, 1);
    assert.equal(fixture.split('function mountStateConsumer(').length - 1, 1);
    assert.doesNotMatch(fixture, /"sharedParts"|"enclosurePartId"|"defaultState"|"states"/);
    assert.equal(
      fixture.includes("import * as expressionFace from '@labpics/icons/states/expression-face'"),
      schema === 3,
    );
  }
});
