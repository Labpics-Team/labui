import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { annulusBrowserProof } from './icons-annulus-consumer.mjs';
import {
  ICONS_HARNESS_FILES,
  assertHarnessFilesUnchanged,
  snapshotHarnessFiles,
} from './icons-harness.mjs';
import { browserProofRecords, browserProofTimeout } from './icons-packed.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const packedUrl = new URL('./icons-packed.mjs', import.meta.url);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const readRepositoryFile = (file) => readFile(join(ROOT, file));

test('progress отличает свежую завершённую запись от остановки при том же общем elapsed', () => {
  const frontier = {
    mode: 'reduce',
    stage: 'annulus',
    member: 'question-circle/outline',
    startedAt: 0,
    stageStartedAt: 90000,
    stageStartedRecord: 250,
    lastCompletedAt: 90000,
    completedStages: [],
  };
  const records = Array.from({ length: 265 }, (_, index) => ({ name: `previous-${index}` }));
  const observed = browserProofRecords(records, frontier, () => 119990);
  assert.equal(Array.isArray(observed), true);
  assert.equal(observed.push({ name: 'plus-circle/filled:reduce:annulus-source' }), 266);
  assert.equal(records.length, 266);
  assert.deepEqual(
    observed.filter((item) => item.name.startsWith('plus')),
    [records.at(-1)],
  );
  assert.equal(JSON.stringify(observed), JSON.stringify(records));
  assert.equal(observed.push(), 266);
  assert.equal(frontier.lastCompletedAt, 119990);
  const progressing = browserProofTimeout(frontier, records, 120002);
  const stalled = browserProofTimeout({ ...frontier, lastCompletedAt: 90000 }, records, 120002);
  assert.equal(progressing.browserFrontier.elapsedMs, stalled.browserFrontier.elapsedMs);
  assert.equal(
    progressing.browserFrontier.completedRecords,
    stalled.browserFrontier.completedRecords,
  );
  assert.equal(progressing.browserFrontier.lastCompletedAtMs, 119990);
  assert.equal(progressing.browserFrontier.sinceLastCompletedMs, 12);
  assert.equal(stalled.browserFrontier.sinceLastCompletedMs, 30002);
  assert.equal(progressing.browserFrontier.stageCompletedRecords, 16);
  assert.equal(progressing.browserFrontier.member, 'question-circle/outline');
  observed.push({ name: 'cleanup' });
  assert.equal(progressing.browserFrontier.completedRecords, 266);
  assert.equal(
    progressing.browserFrontier.lastCompletedRecord,
    'plus-circle/filled:reduce:annulus-source',
  );
});

test('завершённые stages сохраняют elapsed и собственные records без сброса общего начала', async () => {
  const source = await readFile(packedUrl, 'utf8');
  const start = source.indexOf('const mark = (stage, member = null) => {');
  const end = source.indexOf('\n    };', start);
  assert.ok(start >= 0 && end > start);
  const frontier = {
    mode: 'no-preference',
    stage: 'width-motion',
    member: 'mic/outline',
    startedAt: 0,
    stageStartedAt: 90000,
    stageStartedRecord: 0,
    lastCompletedAt: 90000,
    completedStages: [],
  };
  const records = [{ name: 'width-completed' }];
  const mark = new Function(
    'frontier',
    'records',
    'reducedMotion',
    'performance',
    `${source.slice(start, end + 7)}\nreturn mark;`,
  )(frontier, records, 'reduce', { now: () => 112758 });
  mark('annulus');
  assert.equal(frontier.startedAt, 0);
  assert.equal(frontier.stageStartedAt, 112758);
  assert.equal(frontier.stageStartedRecord, 1);
  const failed = browserProofTimeout(frontier, records, 120002);
  assert.deepEqual(failed.browserFrontier.completedStages, [
    {
      mode: 'no-preference',
      stage: 'width-motion',
      member: 'mic/outline',
      elapsedMs: 22758,
      completedRecords: 1,
    },
  ]);
  assert.equal(failed.browserFrontier.stageElapsedMs, 7244);
  assert.equal(failed.browserFrontier.stageCompletedRecords, 0);
  frontier.completedStages[0].stage = 'changed';
  mark('context-close');
  assert.equal(failed.browserFrontier.completedStages.length, 1);
  assert.equal(failed.browserFrontier.completedStages[0].stage, 'width-motion');
});

test('annulus сообщает текущий member до первой browser операции', async () => {
  const failure = new Error('controlled browser boundary');
  let member;
  await assert.rejects(
    annulusBrowserProof(
      {
        locator() {
          throw failure;
        },
      },
      {},
      'reduce',
      [],
      (current) => {
        member = current;
      },
    ),
    (error) => error === failure,
  );
  assert.equal(member, 'alert-circle/outline');
});

test('общий browser deadline сохраняет текущую фазу и последний завершённый шаг', async () => {
  const source = await readFile(packedUrl, 'utf8');
  const start = source.indexOf('proofTimer = setTimeout(');
  const end = source.indexOf(';', start);
  assert.ok(start >= 0 && end > start);
  const records = [{ name: 'status-circle:reduce:state-enclosure-continuity' }];
  const frontier = {
    mode: 'reduce',
    stage: 'state-annulus',
    member: null,
    startedAt: 0,
    stageStartedAt: 118000,
    stageStartedRecord: 0,
    lastCompletedAt: 119500,
    completedStages: [],
  };
  let failure;
  new Function(
    'setTimeout',
    'reject',
    'browserProofTimeout',
    'browserFrontier',
    'records',
    `let proofTimer; ${source.slice(start, end + 1)}`,
  )(
    (callback, delay) => {
      assert.equal(delay, 120_000, 'диагностика не увеличивает deadline');
      callback();
    },
    (error) => {
      failure = error;
    },
    (current, completed) => browserProofTimeout(current, completed, 120000),
    frontier,
    records,
  );
  assert.deepEqual(failure.browserFrontier, {
    mode: 'reduce',
    stage: 'state-annulus',
    member: null,
    elapsedMs: 120000,
    stageElapsedMs: 2000,
    stageCompletedRecords: 1,
    completedRecords: 1,
    lastCompletedRecord: 'status-circle:reduce:state-enclosure-continuity',
    lastCompletedAtMs: 119500,
    sinceLastCompletedMs: 500,
    completedStages: [],
  });
  frontier.stage = 'context-close';
  records.push({ name: 'later-record' });
  assert.equal(failure.browserFrontier.stage, 'state-annulus', 'cleanup не заменяет место отказа');
  assert.equal(failure.browserFrontier.completedRecords, 1);
  assert.ok(failure.message.includes('status-circle:reduce:state-enclosure-continuity'));
  const empty = browserProofTimeout(
    { ...frontier, mode: null, stage: 'start', stageStartedAt: 0, lastCompletedAt: null },
    [],
    0,
  );
  assert.equal(empty.browserFrontier.lastCompletedRecord, null);
  assert.equal(empty.browserFrontier.lastCompletedAtMs, null);
});

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
