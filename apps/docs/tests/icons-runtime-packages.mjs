import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RUNTIME_FIELDS = Object.freeze([
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
]);

// Это адреса исходников, а не отдельный список устанавливаемых зависимостей.
// Один владелец связывает manifest, архивный флаг и рецепт pack для shell.
export const PACKAGE_SOURCES = Object.freeze(
  [
    ['icons', '@labpics/icons', 'icons', '.', '--icons-tarball'],
    ['uiCore', '@labpics/ui-core', 'ui', 'packages/core', '--ui-core-tarball'],
    ['uiMaterials', '@labpics/ui-materials', 'ui', 'packages/materials', '--ui-materials-tarball'],
    ['uiTokens', '@labpics/ui-tokens', 'ui', 'packages/tokens', '--ui-tokens-tarball'],
    ['uiShadow', '@labpics/ui-shadow', 'ui', 'packages/shadow', '--ui-shadow-tarball'],
  ].map(([key, name, source, directory, option]) =>
    Object.freeze({ key, name, source, directory, option }),
  ),
);
export const ARCHIVE_OPTIONS = Object.freeze(PACKAGE_SOURCES.map((item) => item.option));
const BY_KEY = new Map(PACKAGE_SOURCES.map((item) => [item.key, item]));
const BY_NAME = new Map(PACKAGE_SOURCES.map((item) => [item.name, item]));
const ROOT_KEYS = ['icons', 'uiCore'];
const LEGACY_KEYS = ['icons', 'uiCore', 'uiShadow'];
const HASH = /^[a-f0-9]{64}$/;

export function runtimeFields(manifest) {
  return Object.fromEntries(
    RUNTIME_FIELDS.map((field) => {
      const values = manifest[field] ?? {};
      assert.ok(
        values && typeof values === 'object' && !Array.isArray(values),
        `${manifest.name}: неверный runtime field ${field}`,
      );
      for (const [name, range] of Object.entries(values)) {
        assert.ok(
          name.length > 0 && typeof range === 'string' && range.length > 0,
          `${manifest.name}: ${field}.${name}`,
        );
      }
      return [field, values];
    }),
  );
}

// Подготовка source и проверка subject следуют одному обходу, независимо от способа чтения.
function* runtimePackageWalk() {
  const selected = new Set();
  const pending = [...ROOT_KEYS];
  while (pending.length) {
    const key = pending.pop();
    if (selected.has(key)) continue;
    const manifest = yield key;
    assert.ok(
      manifest,
      `Runtime package ${BY_KEY.get(key).name} отсутствует среди исходников/архивов`,
    );
    assert.equal(manifest.name, BY_KEY.get(key).name, `source package name: ${key}`);
    assert.ok(typeof manifest.version === 'string' && manifest.version.length > 0);
    selected.add(key);
    for (const dependencies of Object.values(runtimeFields(manifest))) {
      for (const [name, range] of Object.entries(dependencies)) {
        const dependency = BY_NAME.get(name);
        assert.ok(
          dependency || !range.startsWith('workspace:'),
          `${manifest.name}: runtime workspace dependency ${name} не имеет source/archive binding`,
        );
        if (dependency) pending.push(dependency.key);
      }
    }
  }
  return PACKAGE_SOURCES.filter((item) => selected.has(item.key));
}

function verifiedPlan(manifests, plan) {
  // Проверяется только выбранный closure: dev-пакеты и неиспользуемые варианты не нужны.
  runtimeDependencyContracts(Object.fromEntries(plan.map(({ key }) => [key, manifests[key]])));
  return plan;
}

/** Runtime workspace edge никогда не превращается в непроверенный registry fallback. */
export function runtimePackagePlan(manifests) {
  for (const key of Object.keys(manifests))
    assert.ok(BY_KEY.has(key), `Неизвестный package source: ${key}`);
  const traversal = runtimePackageWalk();
  let step = traversal.next();
  while (!step.done) step = traversal.next(manifests[step.value]);
  return verifiedPlan(manifests, step.value);
}

// pnpm pack материализует shorthand workspace-диапазоны в версии своего source closure.
// Aliases, relative paths и прочие диапазоны требуют отдельного доказанного binding.
export function runtimeDependencyContracts(manifests) {
  const byName = new Map(Object.values(manifests).map((item) => [item.name, item]));
  assert.equal(byName.size, Object.keys(manifests).length, 'Повтор package name');
  return Object.fromEntries(
    Object.entries(manifests).map(([key, manifest]) => [
      key,
      Object.fromEntries(
        Object.entries(runtimeFields(manifest)).map(([field, dependencies]) => [
          field,
          Object.fromEntries(
            Object.entries(dependencies).map(([name, range]) => {
              if (!range.startsWith('workspace:')) {
                const dependency = byName.get(name);
                if (dependency)
                  assert.ok(
                    [
                      dependency.version,
                      `^${dependency.version}`,
                      `~${dependency.version}`,
                    ].includes(range),
                    `${manifest.name}: unsupported local runtime range ${name}@${range}`,
                  );
                return [name, range];
              }
              const dependency = byName.get(name);
              assert.ok(
                dependency,
                `${manifest.name}: runtime workspace dependency ${name} отсутствует среди архивов`,
              );
              const requested = range.slice('workspace:'.length);
              assert.ok(
                ['', '*', '^', '~'].includes(requested),
                `${manifest.name}: unsupported workspace range ${range}`,
              );
              return [
                name,
                `${['^', '~'].includes(requested) ? requested : ''}${dependency.version}`,
              ];
            }),
          ),
        ]),
      ),
    ]),
  );
}

export async function loadRuntimePackagePlan(iconsRoot, uiRoot) {
  const roots = { icons: iconsRoot, ui: uiRoot };
  const manifests = {};
  const traversal = runtimePackageWalk();
  let step = traversal.next();
  while (!step.done) {
    const item = BY_KEY.get(step.value);
    const manifest = JSON.parse(
      await readFile(join(roots[item.source], item.directory, 'package.json')),
    );
    manifests[item.key] = manifest;
    step = traversal.next(manifest);
  }
  return { manifests, plan: verifiedPlan(manifests, step.value) };
}

/** Schema13 хранит точный runtime closure; прежние schema сохраняют свой контракт. */
export function subjectPackagePlan(schemaVersion, packages) {
  assert.ok(Number.isInteger(schemaVersion) && schemaVersion >= 1 && schemaVersion <= 14);
  let plan;
  if (schemaVersion < 13) {
    assert.deepEqual(Object.keys(packages ?? {}).sort(), [...LEGACY_KEYS].sort());
    plan = LEGACY_KEYS.map((key) => BY_KEY.get(key));
  } else {
    assert.ok(packages && typeof packages === 'object' && !Array.isArray(packages));
    const manifests = Object.fromEntries(
      Object.entries(packages).map(([key, item]) => {
        assert.deepEqual(
          Object.keys(item.runtimeDependencies ?? {}).sort(),
          [...RUNTIME_FIELDS].sort(),
          `${key}: неполный runtime contract`,
        );
        return [key, { name: item.name, version: item.version, ...item.runtimeDependencies }];
      }),
    );
    plan = runtimePackagePlan(manifests);
    assert.deepEqual(
      Object.keys(packages).sort(),
      plan.map((item) => item.key).sort(),
      'Архивы не совпадают с runtime closure',
    );
    for (const [key, manifest] of Object.entries(manifests))
      for (const ranges of Object.values(runtimeFields(manifest)))
        assert.ok(
          Object.values(ranges).every((range) => !range.startsWith('workspace:')),
          `${key}: runtime contract не материализован`,
        );
  }
  for (const { key, name } of plan) {
    const item = packages[key];
    assert.equal(item.name, name);
    assert.ok(typeof item.version === 'string' && item.version.length > 0);
    assert.match(item.archiveSha256, HASH);
    assert.ok(Number.isSafeInteger(item.archiveBytes) && item.archiveBytes > 0);
    assert.match(item.sourceCommit, /^[a-f0-9]{40}$/);
  }
  return plan;
}

export function assertArchiveOptions(options, plan) {
  assert.deepEqual(
    ARCHIVE_OPTIONS.filter((option) => options.has(option)).sort(),
    plan.map((item) => item.option).sort(),
    'Tarball flags не совпадают с runtime closure',
  );
}

export function assertArchiveManifest(manifest, expected) {
  assert.equal(manifest.name, expected.name, 'archive package name');
  assert.equal(manifest.version, expected.version, 'archive package version');
  const fields = runtimeFields(manifest);
  assert.ok(
    Object.values(fields).every((dependencies) =>
      Object.values(dependencies).every((range) => !range.startsWith('workspace:')),
    ),
    `${expected.name}: архив сохранил runtime workspace dependency`,
  );
  if (expected.runtimeDependencies)
    assert.deepEqual(
      fields,
      expected.runtimeDependencies,
      `${expected.name}: archive runtime dependencies differ from source`,
    );
}

export function readArchiveManifest(path, expected) {
  // Читается один файл в stdout; произвольные archive paths не извлекаются на диск.
  const bytes = execFileSync('tar', ['-xOf', path, 'package/package.json'], {
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  });
  const manifest = JSON.parse(bytes);
  assertArchiveManifest(manifest, expected);
  return manifest;
}

export function assertInstalledPackage(manifest, expected, locked, archive) {
  assertArchiveManifest(manifest, expected);
  if (archive) {
    assert.ok(
      typeof archive.integrity === 'string' &&
        /^sha512-[A-Za-z0-9+/]{86}==$/.test(archive.integrity),
      `${expected.name}: отсутствует snapshot SHA512`,
    );
    assert.ok(
      typeof locked?.integrity === 'string' &&
        locked.integrity.split(/\s+/).includes(archive.integrity),
      `${expected.name}: installed lock integrity не совпадает со snapshot`,
    );
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(
    process.argv.length === 5 && process.argv[2] === '--pack-plan',
    'Нужны --pack-plan <icons-source> <ui-source>',
  );
  const { plan } = await loadRuntimePackagePlan(resolve(process.argv[3]), resolve(process.argv[4]));
  for (const { key, directory, option } of plan)
    process.stdout.write(`${key} ${directory} ${option}\n`);
}
