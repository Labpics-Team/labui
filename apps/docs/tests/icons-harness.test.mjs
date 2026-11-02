import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ICONS_HARNESS_FILES,
  assertHarnessFilesUnchanged,
  snapshotHarnessFiles,
} from './icons-harness.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const packedUrl = new URL('./icons-packed.mjs', import.meta.url);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const readRepositoryFile = (file) => readFile(join(ROOT, file));

async function actualInitialSnapshot(root = ROOT) {
  const source = await readFile(packedUrl, 'utf8');
  const start = source.indexOf('const harnessFiles =');
  const end = source.indexOf('receipt.harness =', start);
  assert.ok(start >= 0 && end > start, 'Не найдена граница начального receipt');
  const block = source
    .slice(start, end)
    .replaceAll('import.meta.url', JSON.stringify(packedUrl.href));
  return new AsyncFunction(
    'readFile',
    'hash',
    'ROOT',
    'join',
    'snapshotHarnessFiles',
    `${block}\nreturn harnessFiles;`,
  )(readFile, hash, root, join, snapshotHarnessFiles);
}

async function actualFinalCheck(snapshot, root = ROOT) {
  const source = await readFile(packedUrl, 'utf8');
  const start = source.indexOf('await assertHarnessFilesUnchanged(receipt.harness.files');
  const end = source.indexOf("receipt.outcome = 'passed';", start);
  assert.ok(start >= 0 && end > start, 'Не найдена граница финального source guard');
  return new AsyncFunction(
    'receipt',
    'readFile',
    'ROOT',
    'join',
    'assertHarnessFilesUnchanged',
    source.slice(start, end),
  )({ harness: { files: snapshot } }, readFile, root, join, assertHarnessFilesUnchanged);
}

async function sourceFixture(t) {
  const parent = await realpath(tmpdir());
  const root = await mkdtemp(join(parent, 'labui-harness-proof-'));
  t.after(async () => {
    const target = await realpath(root);
    assert.equal(dirname(target), parent);
    assert.ok(basename(target).startsWith('labui-harness-proof-'));
    await rm(target, { recursive: true, force: true });
  });
  for (const file of ICONS_HARNESS_FILES) {
    const target = join(root, file);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, await readRepositoryFile(file));
  }
  return { root, read: (file) => readFile(join(root, file)) };
}

test('начальный receipt настоящего harness содержит исполняемый state-annulus модуль', async () => {
  const snapshot = await actualInitialSnapshot();
  assert.ok(
    snapshot.some((item) => item.file === 'apps/docs/tests/icons-state-annulus-consumer.mjs'),
    'Receipt пропустил исполняемый state-annulus source',
  );
  assert.deepEqual(
    snapshot.map((item) => item.file),
    ICONS_HARNESS_FILES,
  );
  await actualFinalCheck(snapshot);
});

test('снимок принимает здоровый consumer и фиксирует owner и entrypoint', async () => {
  const snapshot = await snapshotHarnessFiles(readRepositoryFile);
  assert.ok(Object.isFrozen(ICONS_HARNESS_FILES));
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(snapshot.every(Object.isFrozen));
  assert.ok(ICONS_HARNESS_FILES.includes('apps/docs/tests/icons-harness.mjs'));
  assert.ok(ICONS_HARNESS_FILES.includes('apps/docs/tests/icons-packed.mjs'));
  assert.equal(new Set(ICONS_HARNESS_FILES).size, ICONS_HARNESS_FILES.length);
  for (const item of snapshot) {
    assert.equal(item.sha256, hash(await readRepositoryFile(item.file)));
  }
  await assertHarnessFilesUnchanged(snapshot, readRepositoryFile);
});

test('реальный final guard отвергает изменение любого исходника во время прогона', async (t) => {
  for (const file of ICONS_HARNESS_FILES) {
    await t.test(file, async (t) => {
      const fixture = await sourceFixture(t);
      const snapshot = await actualInitialSnapshot(fixture.root);
      const bytes = await fixture.read(file);
      await writeFile(
        join(fixture.root, file),
        Buffer.concat([bytes, Buffer.from('\n// changed during run\n')]),
      );
      await assert.rejects(actualFinalCheck(snapshot, fixture.root), (error) =>
        error.message.includes(`Изменён source harness: ${file}`),
      );
    });
  }
});

test('неполный или изменённый набор receipt не сокращает область проверки', async (t) => {
  const snapshot = await snapshotHarnessFiles(readRepositoryFile);
  const invalid = [
    ['пустой набор', []],
    ['перестановка', [...snapshot].reverse()],
    [
      'чужой файл',
      [{ ...snapshot[0], file: 'apps/docs/tests/unregistered.mjs' }, ...snapshot.slice(1)],
    ],
    ...snapshot.flatMap((item, index) => [
      [`пропущен ${item.file}`, snapshot.filter((_, position) => position !== index)],
      [`повторён ${item.file}`, [...snapshot.slice(0, index), item, ...snapshot.slice(index)]],
    ]),
  ];
  for (const [name, records] of invalid) {
    await t.test(name, async () => {
      let reads = 0;
      await assert.rejects(
        assertHarnessFilesUnchanged(records, async () => {
          reads++;
          return Buffer.alloc(0);
        }),
        /Неполный или изменённый набор source harness/,
      );
      assert.equal(reads, 0);
    });
  }
});

test('receipt требует реальные SHA256 без дополнительных полей', async (t) => {
  const snapshot = await snapshotHarnessFiles(readRepositoryFile);
  for (const [name, update] of [
    ['пустой SHA', (item) => ({ ...item, sha256: '' })],
    ['неверный SHA', (item) => ({ ...item, sha256: '0'.repeat(64) })],
    ['дополнительное поле', (item) => ({ ...item, accepted: true })],
  ]) {
    await t.test(name, async () => {
      const records = snapshot.map((item, index) => (index === 0 ? update(item) : item));
      await assert.rejects(assertHarnessFilesUnchanged(records, readRepositoryFile));
    });
  }
});

test('отказ чтения любого source сохраняется при snapshot и final check', async (t) => {
  const snapshot = await snapshotHarnessFiles(readRepositoryFile);
  for (const unavailable of ICONS_HARNESS_FILES) {
    await t.test(unavailable, async () => {
      const failure = Object.assign(new Error(`Source недоступен: ${unavailable}`), {
        code: 'ENOENT',
      });
      const read = (file) =>
        file === unavailable ? Promise.reject(failure) : readRepositoryFile(file);
      await assert.rejects(snapshotHarnessFiles(read), (error) => error === failure);
      await assert.rejects(
        assertHarnessFilesUnchanged(snapshot, read),
        (error) => error === failure,
      );
    });
  }
});

test('owner содержит прямые source imports и совпадает с preparation', async () => {
  const source = await readFile(packedUrl, 'utf8');
  const relativeImports = [...source.matchAll(/from\s+['"]\.\/([^'"]+\.mjs)['"]/g)].map(
    (match) => `apps/docs/tests/${match[1]}`,
  );
  assert.ok(relativeImports.includes('apps/docs/tests/icons-state-annulus-consumer.mjs'));
  for (const file of relativeImports) {
    assert.ok(ICONS_HARNESS_FILES.includes(file), `Незакреплённый source import: ${file}`);
  }
  const preparation = await readFile(
    new URL('./prepare-icons-inputs.mjs', import.meta.url),
    'utf8',
  );
  const start = preparation.indexOf('for (const file of ICONS_HARNESS_FILES)');
  const end = preparation.indexOf('const subject =', start);
  assert.ok(start >= 0 && end > start, 'Preparation не использует общий source набор');
  const files = [];
  await new AsyncFunction(
    'ICONS_HARNESS_FILES',
    'files',
    'sourceFile',
    'uiRoot',
    'uiCommit',
    preparation.slice(start, end),
  )(
    ICONS_HARNESS_FILES,
    files,
    async (_root, _commit, file) => ({ file, sha256: hash(await readRepositoryFile(file)) }),
    ROOT,
    'source-commit',
  );
  assert.deepEqual(
    files.map((item) => item.file),
    ICONS_HARNESS_FILES,
  );
});
