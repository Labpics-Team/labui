import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { assertIconsImport, assertPublicEntryModules } from './icons-packed.mjs';

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

test('tree-shaken public facades qualify through retained dependency modules', async () => {
  const { entries } = await resolvedFixture({
    button: 'button.mjs',
    reload: 'reload.mjs',
    motion: 'motion.mjs',
  });
  const imports = new Map(Object.values(entries).map((id) => [id, [`${id}:implementation`]]));
  const modules = new Set([...imports.values()].flat());
  assertPublicEntryModules(modules, entries, imports);
  modules.delete(`${entries['@labpics/icons/symbols/reload']}:implementation`);
  assert.throws(() => assertPublicEntryModules(modules, entries, imports), /symbols\/reload/);
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

test('wrong public symbols and whole catalogs refuse independently of private placement', () => {
  for (const specifier of [
    '@labpics/icons/symbols/arrow',
    '@labpics/icons/ir',
    '@labpics/icons/ir/recipes',
    '@labpics/icons/ir/candidates',
    '@labpics/icons',
  ])
    assert.throws(() => assertIconsImport(specifier), /чужой symbol или whole catalog/);
  for (const specifier of [
    '@labpics/icons/symbols/reload',
    '@labpics/icons/ir/render',
    '@labpics/icons/motion',
    '@labpics/ui-core/button',
    './shared.mjs',
  ])
    assert.doesNotThrow(() => assertIconsImport(specifier));
});
