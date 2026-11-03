import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { test } from 'node:test';
import {
  PACKAGE_SOURCES,
  assertArchiveManifest,
  assertArchiveOptions,
  assertInstalledPackage,
  loadRuntimePackagePlan,
  readArchiveManifest,
  runtimeDependencyContracts,
  runtimeFields,
  runtimePackagePlan,
  subjectPackagePlan,
} from './icons-runtime-packages.mjs';

test('CI запускает Icons consumer для каждого объявленного UI runtime source', async () => {
  const workflow = await readFile(
    new URL('../../../.github/workflows/icons-consumer.yml', import.meta.url),
    'utf8',
  );
  const block = workflow.split('paths: &consumer-paths')[1]?.split('\n  pull_request:')[0];
  assert.ok(block, 'Отсутствует общий consumer paths owner');
  const paths = [...block.matchAll(/^\s+-\s+'([^']+)'\s*$/gm)].map((match) => match[1]);
  for (const { directory } of PACKAGE_SOURCES.filter((item) => item.source === 'ui'))
    assert.ok(
      paths.includes(`${directory}/**`) || paths.includes('packages/**') || paths.includes('**'),
      `Icons consumer не запускается для ${directory}`,
    );
});

const names = {
  icons: '@labpics/icons',
  uiCore: '@labpics/ui-core',
  uiMaterials: '@labpics/ui-materials',
  uiTokens: '@labpics/ui-tokens',
  uiShadow: '@labpics/ui-shadow',
};
const directories = {
  icons: 'icons',
  uiCore: 'ui/packages/core',
  uiMaterials: 'ui/packages/materials',
  uiTokens: 'ui/packages/tokens',
  uiShadow: 'ui/packages/shadow',
};
const emptyRuntime = () => ({ dependencies: {}, optionalDependencies: {}, peerDependencies: {} });
const packageManifest = (key, fields = {}) => ({ name: names[key], version: '2.0.0', ...fields });
const keys = (plan) => plan.map((item) => item.key);

function currentManifests() {
  return {
    icons: packageManifest('icons', { devDependencies: { '@labpics/ui-tokens': 'workspace:*' } }),
    uiCore: packageManifest('uiCore', {
      dependencies: { '@labpics/ui-shadow': 'workspace:*', lit: '3.3.3' },
      peerDependencies: { '@lit-labs/ssr': '^4.1.0' },
      devDependencies: { '@labpics/ui-materials': 'workspace:*' },
    }),
    uiShadow: packageManifest('uiShadow'),
  };
}

function expandedManifests() {
  const manifests = currentManifests();
  Reflect.deleteProperty(manifests.uiCore.dependencies, '@labpics/ui-shadow');
  manifests.uiCore.dependencies['@labpics/ui-materials'] = 'workspace:*';
  manifests.uiMaterials = packageManifest('uiMaterials', {
    optionalDependencies: { '@labpics/ui-tokens': 'workspace:^' },
  });
  manifests.uiTokens = packageManifest('uiTokens', {
    peerDependencies: { '@labpics/ui-shadow': 'workspace:~' },
  });
  return manifests;
}

function expectedPackages(expanded = false) {
  const contracts = {
    icons: emptyRuntime(),
    uiCore: {
      dependencies: { '@labpics/ui-shadow': '2.0.0', lit: '3.3.3' },
      optionalDependencies: {},
      peerDependencies: { '@lit-labs/ssr': '^4.1.0' },
    },
    uiShadow: emptyRuntime(),
  };
  if (expanded) {
    Reflect.deleteProperty(contracts.uiCore.dependencies, '@labpics/ui-shadow');
    contracts.uiCore.dependencies['@labpics/ui-materials'] = '2.0.0';
    contracts.uiMaterials = {
      dependencies: {},
      optionalDependencies: { '@labpics/ui-tokens': '^2.0.0' },
      peerDependencies: {},
    };
    contracts.uiTokens = {
      dependencies: {},
      optionalDependencies: {},
      peerDependencies: { '@labpics/ui-shadow': '~2.0.0' },
    };
  }
  return Object.fromEntries(
    Object.entries(contracts).map(([key, runtimeDependencies]) => [
      key,
      {
        name: names[key],
        version: '2.0.0',
        archiveSha256: 'a'.repeat(64),
        archiveBytes: 123,
        sourceCommit: 'b'.repeat(40),
        runtimeDependencies,
      },
    ]),
  );
}

async function inTemporaryTree(action) {
  const parent = await realpath(tmpdir());
  const root = await mkdtemp(join(parent, 'labui-icons-runtime-'));
  try {
    return await action(root);
  } finally {
    const target = await realpath(root);
    assert.equal(dirname(target), parent);
    assert.ok(basename(target).startsWith('labui-icons-runtime-'));
    await rm(target, { recursive: true, force: true });
  }
}

async function writeSourceManifests(root, manifests) {
  for (const [key, manifest] of Object.entries(manifests)) {
    const directory = join(root, directories[key]);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'package.json'), JSON.stringify(manifest));
  }
}

test('current runtime selects three archives and ignores known dev-only packages', () => {
  const manifests = currentManifests();
  const untouched = structuredClone(manifests);
  assert.deepEqual(keys(runtimePackagePlan(manifests)), ['icons', 'uiCore', 'uiShadow']);
  assert.deepEqual(manifests, untouched);
  assert.deepEqual(
    runtimeDependencyContracts(manifests),
    Object.fromEntries(
      Object.entries(expectedPackages()).map(([key, item]) => [key, item.runtimeDependencies]),
    ),
  );
});

test('runtime traversal includes dependencies, optional edges and peer edges transitively', () => {
  const manifests = expandedManifests();
  const untouched = structuredClone(manifests);
  assert.deepEqual(keys(runtimePackagePlan(manifests)), [
    'icons',
    'uiCore',
    'uiMaterials',
    'uiTokens',
    'uiShadow',
  ]);
  assert.deepEqual(
    runtimeDependencyContracts(manifests),
    Object.fromEntries(
      Object.entries(expectedPackages(true)).map(([key, item]) => [key, item.runtimeDependencies]),
    ),
  );
  assert.deepEqual(manifests, untouched);
});

test('runtime selection is independent of source order and terminates on a legal peer cycle', () => {
  const manifests = expandedManifests();
  manifests.uiShadow.peerDependencies = { '@labpics/ui-core': 'workspace:*' };
  const entries = Object.entries(manifests);
  const expected = ['icons', 'uiCore', 'uiMaterials', 'uiTokens', 'uiShadow'];
  for (let offset = 0; offset < entries.length; offset += 1) {
    const order = [...entries.slice(offset), ...entries.slice(0, offset)];
    assert.deepEqual(keys(runtimePackagePlan(Object.fromEntries(order))), expected);
    assert.deepEqual(keys(runtimePackagePlan(Object.fromEntries(order.reverse()))), expected);
  }
});

for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
  test(`missing runtime source/archive refuses before registry fallback in ${field}`, () => {
    const manifests = currentManifests();
    manifests.uiCore[field] = { '@labpics/ui-materials': 'workspace:*' };
    assert.throws(() => runtimePackagePlan(manifests), /ui-materials/);
    manifests.uiCore[field] = { '@labpics/not-registered': 'workspace:*' };
    assert.throws(() => runtimePackagePlan(manifests), /not-registered/);
  });

  test(`known local incompatible range refuses rather than creating nested registry copy in ${field}`, () => {
    const manifests = currentManifests();
    manifests.uiCore[field] = { '@labpics/ui-shadow': '3.0.0' };
    assert.throws(() => runtimePackagePlan(manifests), /ui-shadow|range|version/);
    manifests.uiCore[field] = { '@labpics/ui-shadow': '2.0.0' };
    assert.deepEqual(keys(runtimePackagePlan(manifests)), ['icons', 'uiCore', 'uiShadow']);
  });
}

test('selected-only source loading permits absent unused materials and tokens directories', async () => {
  await inTemporaryTree(async (root) => {
    await writeSourceManifests(root, currentManifests());
    const { manifests, plan } = await loadRuntimePackagePlan(join(root, 'icons'), join(root, 'ui'));
    assert.deepEqual(keys(plan), ['icons', 'uiCore', 'uiShadow']);
    assert.deepEqual(Object.keys(manifests).sort(), ['icons', 'uiCore', 'uiShadow']);
  });
});

test('selected source loading reads the five-package closure and refuses missing transitive source', async () => {
  await inTemporaryTree(async (root) => {
    await writeSourceManifests(root, expandedManifests());
    assert.deepEqual(
      keys((await loadRuntimePackagePlan(join(root, 'icons'), join(root, 'ui'))).plan),
      ['icons', 'uiCore', 'uiMaterials', 'uiTokens', 'uiShadow'],
    );
    await rm(join(root, directories.uiTokens, 'package.json'));
    await assert.rejects(
      loadRuntimePackagePlan(join(root, 'icons'), join(root, 'ui')),
      /ui-tokens|tokens|Runtime package/,
    );
  });
});

test('workspace shorthand becomes the selected source version while external ranges remain intact', () => {
  for (const [input, output] of [
    ['workspace:', '2.0.0'],
    ['workspace:*', '2.0.0'],
    ['workspace:^', '^2.0.0'],
    ['workspace:~', '~2.0.0'],
    ['2.0.0', '2.0.0'],
    ['^2.0.0', '^2.0.0'],
    ['~2.0.0', '~2.0.0'],
  ]) {
    const manifests = currentManifests();
    manifests.uiCore.dependencies['@labpics/ui-shadow'] = input;
    const contracts = runtimeDependencyContracts(manifests);
    assert.equal(contracts.uiCore.dependencies['@labpics/ui-shadow'], output);
    assert.equal(contracts.uiCore.dependencies.lit, '3.3.3');
    assert.equal(contracts.uiCore.peerDependencies['@lit-labs/ssr'], '^4.1.0');
  }
});

test('unsupported workspace alias, path and explicit ranges receive a precise refusal', () => {
  for (const input of ['workspace:3.0.0', 'workspace:../shadow', 'workspace:other@*']) {
    const manifests = currentManifests();
    manifests.uiCore.dependencies['@labpics/ui-shadow'] = input;
    assert.throws(() => runtimeDependencyContracts(manifests), /workspace range|range|binding/);
  }
});

test('schema13–15 accept exactly the actual three or five archive closure', () => {
  for (const schema of [13, 14, 15]) {
    assert.deepEqual(keys(subjectPackagePlan(schema, expectedPackages())), [
      'icons',
      'uiCore',
      'uiShadow',
    ]);
    assert.deepEqual(keys(subjectPackagePlan(schema, expectedPackages(true))), [
      'icons',
      'uiCore',
      'uiMaterials',
      'uiTokens',
      'uiShadow',
    ]);
    const excess = expectedPackages();
    excess.uiMaterials = expectedPackages(true).uiMaterials;
    assert.throws(() => subjectPackagePlan(schema, excess), /closure/);
    const missing = expectedPackages(true);
    Reflect.deleteProperty(missing, 'uiTokens');
    assert.throws(() => subjectPackagePlan(schema, missing), /ui-tokens|архивов/);
  }
  assert.throws(() => subjectPackagePlan(16, expectedPackages()));
});

test('all legacy schema1–12 retain the three-package contract', () => {
  for (let schema = 1; schema <= 12; schema += 1) {
    const packages = expectedPackages();
    for (const item of Object.values(packages)) Reflect.deleteProperty(item, 'runtimeDependencies');
    assert.deepEqual(keys(subjectPackagePlan(schema, packages)), ['icons', 'uiCore', 'uiShadow']);
    assert.throws(() => subjectPackagePlan(schema, expectedPackages(true)));
  }
});

test('schema13–15 refuse incomplete, unresolved or malformed runtime contract metadata', () => {
  for (const schema of [13, 14, 15]) {
    for (const mutate of [
      (item) => {
        Reflect.deleteProperty(item.runtimeDependencies, 'peerDependencies');
      },
      (item) => {
        item.runtimeDependencies.dependencies['@labpics/ui-shadow'] = 'workspace:*';
      },
      (item) => {
        item.runtimeDependencies.optionalDependencies = [];
      },
      (item) => {
        item.runtimeDependencies.peerDependencies.external = 1;
      },
    ]) {
      const packages = expectedPackages();
      mutate(packages.uiCore);
      assert.throws(() => subjectPackagePlan(schema, packages));
    }
  }
});

test('runtime manifest fields normalize absent sections without admitting malformed dependency maps', () => {
  assert.deepEqual(runtimeFields(packageManifest('icons')), emptyRuntime());
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const value of [[], 'lit', 1, { lit: '' }, { lit: 2 }]) {
      assert.throws(
        () => runtimeFields(packageManifest('icons', { [field]: value })),
        /runtime field|lit/,
      );
    }
  }
});

test('archive arguments must match the selected closure without missing or surplus archives', () => {
  const current = runtimePackagePlan(currentManifests());
  const options = new Map([
    ['--icons-tarball', 'icons.tgz'],
    ['--ui-core-tarball', 'core.tgz'],
    ['--ui-shadow-tarball', 'shadow.tgz'],
    ['--out', 'output'],
  ]);
  assertArchiveOptions(options, current);
  options.set('--ui-materials-tarball', 'materials.tgz');
  assert.throws(() => assertArchiveOptions(options, current), /closure/);
  options.delete('--ui-materials-tarball');
  options.delete('--ui-shadow-tarball');
  assert.throws(() => assertArchiveOptions(options, current), /closure/);
  const expanded = runtimePackagePlan(expandedManifests());
  assertArchiveOptions(
    new Map([
      ['--icons-tarball', 'icons.tgz'],
      ['--ui-core-tarball', 'core.tgz'],
      ['--ui-materials-tarball', 'materials.tgz'],
      ['--ui-tokens-tarball', 'tokens.tgz'],
      ['--ui-shadow-tarball', 'shadow.tgz'],
    ]),
    expanded,
  );
});

function packedCore() {
  const expected = expectedPackages().uiCore;
  return {
    name: expected.name,
    version: expected.version,
    ...structuredClone(expected.runtimeDependencies),
  };
}

test('archive manifest must preserve source identity and every runtime field before install', () => {
  const expected = expectedPackages().uiCore;
  assertArchiveManifest(packedCore(), expected);
  for (const mutate of [
    (manifest) => {
      manifest.name = '@labpics/ui-shadow';
    },
    (manifest) => {
      manifest.version = '2.0.1';
    },
    (manifest) => {
      Reflect.deleteProperty(manifest.dependencies, '@labpics/ui-shadow');
    },
    (manifest) => {
      manifest.optionalDependencies.external = '1.0.0';
    },
    (manifest) => {
      manifest.peerDependencies['@lit-labs/ssr'] = '^4.2.0';
    },
    (manifest) => {
      manifest.dependencies['@labpics/ui-shadow'] = 'workspace:*';
    },
  ]) {
    const manifest = packedCore();
    mutate(manifest);
    assert.throws(() => assertArchiveManifest(manifest, expected), /archive|runtime workspace/);
  }
});

test('real tarball manifest reading preserves lawful bytes and refuses the wrong package', async () => {
  await inTemporaryTree(async (root) => {
    const packageRoot = join(root, 'package');
    await mkdir(packageRoot);
    const manifest = packedCore();
    await writeFile(join(packageRoot, 'package.json'), JSON.stringify(manifest));
    const archive = join(root, 'core.tgz');
    execFileSync('tar', ['-czf', archive, '-C', root, 'package'], { timeout: 10_000 });
    const bytes = await readFile(archive);
    assert.deepEqual(readArchiveManifest(archive, expectedPackages().uiCore), manifest);
    assert.deepEqual(await readFile(archive), bytes);
    assert.throws(
      () => readArchiveManifest(archive, expectedPackages().uiShadow),
      /archive package name/,
    );
  });
});

test('installed package must preserve archive semantics and the exact snapshot SHA512 lock', () => {
  const expected = expectedPackages().uiCore;
  const integrity = `sha512-${createHash('sha512').update('controlled archive').digest('base64')}`;
  const other = `sha512-${createHash('sha512').update('different archive').digest('base64')}`;
  const snapshot = { integrity };
  const locked = { integrity };
  assertInstalledPackage(packedCore(), expected, locked, snapshot);
  assertInstalledPackage(
    packedCore(),
    expected,
    { integrity: `sha256-control ${integrity}` },
    snapshot,
  );
  for (const missing of [undefined, {}, { integrity: '' }, { integrity: other }]) {
    assert.throws(
      () => assertInstalledPackage(packedCore(), expected, missing, snapshot),
      /integrity/,
    );
  }
  for (const invalid of [{}, { integrity: '' }, { integrity: 'sha256-control' }]) {
    assert.throws(() => assertInstalledPackage(packedCore(), expected, locked, invalid), /SHA512/);
  }
  const changed = packedCore();
  changed.dependencies['@labpics/ui-shadow'] = '2.0.1';
  assert.throws(
    () => assertInstalledPackage(changed, expected, locked, snapshot),
    /archive runtime/,
  );
});
