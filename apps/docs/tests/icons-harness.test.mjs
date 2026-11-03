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
import {
  browserFailureFrontier,
  browserProofModes,
  browserProofRecords,
  browserProofTimeout,
  closeBrowserProof,
  snapshotBrowserFrontier,
} from './icons-packed.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const packedUrl = new URL('./icons-packed.mjs', import.meta.url);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const readRepositoryFile = (file) => readFile(join(ROOT, file));

function initialFrontier() {
  return {
    mode: null,
    stage: 'start',
    member: null,
    startedAt: 0,
    stageStartedAt: 0,
    stageStartedRecord: 0,
    lastCompletedAt: null,
    completedStages: [],
  };
}

async function actualCallerCatch() {
  const source = await readFile(packedUrl, 'utf8');
  const main = source.indexOf('export async function main(');
  const start = source.indexOf("  } catch (error) {\n    receipt.outcome = 'failed';", main);
  const end = source.indexOf('\n  } finally {\n    clearTimeout(proofTimer);', start);
  assert.ok(main >= 0 && start > main && end > start);
  return new Function(
    'receipt',
    'error',
    'phase',
    'browserErrors',
    'browserFrontier',
    'records',
    'browserFailureFrontier',
    `let failure;\n${source.slice(start + '  } catch (error) {'.length, end)}\nreturn failure;`,
  );
}

test('caller catch сохраняет обычный browser failure и immutable frontier после позднего progress', async () => {
  const capture = await actualCallerCatch();
  const records = [{ name: 'accepted' }];
  const frontier = {
    ...initialFrontier(),
    mode: 'reduce',
    stage: 'annulus',
    member: 'mic-circle/outline',
  };
  const original = Object.assign(new Error('controlled browser error'), {
    stateContinuity: { differences: [{ partId: 'mic-body', delta: 0.01 }] },
  });
  const receipt = {};
  const primary = capture(
    receipt,
    original,
    'browser',
    [],
    frontier,
    records,
    (error, current, completed) => browserFailureFrontier(error, current, completed, 1000),
  );
  assert.equal(primary, original);
  assert.equal(receipt.failure.phase, 'browser');
  assert.equal(receipt.failure.message, original.stack);
  assert.equal(receipt.failure.stateContinuity, original.stateContinuity);
  assert.equal(receipt.failure.browserFrontier?.stage, 'annulus');
  assert.equal(receipt.failure.browserFrontier.member, 'mic-circle/outline');
  assert.equal(receipt.failure.browserFrontier.elapsedMs, 1000);
  assert.ok(Object.isFrozen(receipt.failure.browserFrontier));
  frontier.stage = 'context-close';
  frontier.completedStages.push({
    mode: 'reduce',
    stage: 'late',
    member: null,
    elapsedMs: 1,
    completedRecords: 0,
  });
  records.push({ name: 'late' });
  assert.equal(receipt.failure.browserFrontier.stage, 'annulus');
  assert.equal(receipt.failure.browserFrontier.completedRecords, 1);
  assert.deepEqual(receipt.failure.browserFrontier.completedStages, []);
});

test('caller catch предпочитает supplied timeout snapshot и не удерживает mutable alias', async () => {
  const capture = await actualCallerCatch();
  const diagnostic = structuredClone(
    browserProofTimeout(
      { ...initialFrontier(), mode: 'reduce', stage: 'annulus', member: 'mic-circle/filled' },
      [],
      500,
    ).browserFrontier,
  );
  const original = Object.assign(new Error('controlled supplied failure'), {
    browserFrontier: diagnostic,
  });
  const receipt = {};
  assert.equal(
    capture(
      receipt,
      original,
      'browser',
      [],
      { ...initialFrontier(), stage: 'context-close' },
      [],
      (error, current, completed) => browserFailureFrontier(error, current, completed, 1000),
    ),
    original,
  );
  assert.deepEqual(receipt.failure.browserFrontier, diagnostic);
  assert.notEqual(receipt.failure.browserFrontier, diagnostic);
  diagnostic.stage = 'late';
  diagnostic.completedStages.push({
    mode: 'reduce',
    stage: 'late',
    member: null,
    elapsedMs: 1,
    completedRecords: 0,
  });
  assert.equal(receipt.failure.browserFrontier.stage, 'annulus');
  assert.deepEqual(receipt.failure.browserFrontier.completedStages, []);
});

test('caller catch не выдумывает browser frontier до начала browser и сохраняет primary error', async () => {
  const capture = await actualCallerCatch();
  const original = new Error('controlled install failure');
  const receipt = {};
  assert.equal(
    capture(receipt, original, 'install', [], undefined, [], (error, current, completed) =>
      browserFailureFrontier(error, current, completed, 1000),
    ),
    original,
  );
  assert.equal(receipt.failure.phase, 'install');
  assert.equal(Object.hasOwn(receipt.failure, 'browserFrontier'), false);
});

test('caller frontier находится в catch scope и qualification считает фактический archive plan', async () => {
  const source = await readFile(packedUrl, 'utf8');
  const main = source.indexOf('export async function main(');
  const scope = source.slice(
    source.indexOf('  let consumer;', main),
    source.indexOf('  try {', main),
  );
  assert.match(scope, /let browserFrontier;/);
  const start = source.indexOf('    receipt.qualification =', main);
  const end = source.indexOf('\n  } catch (error)', start);
  const qualify = new Function('receipt', 'packagePlan', source.slice(start, end));
  for (const count of [3, 5]) {
    const receipt = {};
    qualify(receipt, Array.from({ length: count }));
    assert.ok(receipt.qualification.includes(String(count)));
  }
});

async function actualBrowserProof() {
  const source = await readFile(packedUrl, 'utf8');
  const start = source.indexOf('function browserProof(');
  const end = source.indexOf('\nexport function assertNotificationPose', start);
  assert.ok(start >= 0 && end > start);
  return new Function(
    'browserProofModes',
    'performance',
    'join',
    'snapshotBrowserFrontier',
    `${source.slice(start, end)}\nreturn browserProof;`,
  )(browserProofModes, performance, join, snapshotBrowserFrontier);
}

for (const closeFails of [false, true]) {
  test(`настоящий mode callback сохраняет navigation failure при closeFails=${closeFails}`, async () => {
    const original = new Error('controlled navigation failure');
    const captureFailure = new Error('controlled capture failure');
    const cleanupErrors = [];
    const closing = [];
    const browser = {
      async newContext({ reducedMotion }) {
        return {
          async newPage() {
            return {
              setDefaultTimeout(timeout) {
                assert.equal(timeout, 20_000);
              },
              on() {},
              async goto() {
                throw original;
              },
              async screenshot() {
                throw captureFailure;
              },
            };
          },
          async close() {
            closing.push(reducedMotion);
            if (closeFails) throw new Error(`controlled ${reducedMotion} close failure`);
          },
        };
      },
    };
    const run = await actualBrowserProof();
    const frontier = initialFrontier();
    const records = [];
    const work = run(browser, 'http://controlled', {}, 'out', records, [], frontier, cleanupErrors);
    await assert.rejects(work.result, (error) => error === original);
    const results = await work.settled;
    assert.ok(
      results.every((result) => result.status === 'rejected' && result.reason === original),
    );
    assert.deepEqual(closing, ['no-preference', 'reduce']);
    const early = frontier.failureSnapshot;
    assert.equal(early.mode, 'no-preference');
    assert.equal(early.stage, 'navigation');
    assert.equal(early.member, null);
    assert.equal(early.completedRecords, 0);
    assert.equal(early.modes['no-preference'].stage, 'navigation');
    assert.ok(Object.isFrozen(early));
    assert.ok(Object.isFrozen(early.modes));
    assert.ok(Object.isFrozen(early.modes['no-preference'].completedStages));
    assert.ok(Object.isFrozen(early.modes['no-preference'].completedStages[0]));
    assert.equal(frontier.modes['no-preference'].frontier.stage, 'context-close');
    assert.equal(frontier.modes.reduce.frontier.stage, 'context-close');
    assert.equal(Object.hasOwn(original, 'browserFrontier'), false);
    const capture = await actualCallerCatch();
    const receipt = {};
    assert.equal(
      capture(receipt, original, 'browser', [], frontier, records, browserFailureFrontier),
      original,
    );
    assert.deepEqual(receipt.failure.browserFrontier, early);
    assert.notEqual(receipt.failure.browserFrontier, early);
    frontier.modes.reduce.frontier.member = 'late';
    frontier.failureSnapshot = snapshotBrowserFrontier(frontier, records);
    assert.deepEqual(receipt.failure.browserFrontier, early);
    assert.deepEqual(
      cleanupErrors,
      closeFails
        ? [
            'Error: controlled no-preference close failure',
            'Error: controlled reduce close failure',
          ]
        : [],
    );
  });
}

for (const sharedError of [false, true]) {
  test(`frontier совпадает с mode, чей отказ дошёл первым, при sharedError=${sharedError}`, async () => {
    const first = Object.assign(new Error('controlled first navigation failure'), {
      stateContinuity: { member: 'first' },
    });
    const second = sharedError
      ? first
      : Object.assign(new Error('controlled second navigation failure'), {
          stateContinuity: { member: 'second' },
        });
    const deferred = () => {
      let resolve;
      const promise = new Promise((complete) => {
        resolve = complete;
      });
      return { promise, resolve };
    };
    const firstCapturing = deferred();
    const finishFirstCapture = deferred();
    const failSecondNavigation = deferred();
    const captures = [];
    const closing = [];
    const browser = {
      async newContext({ reducedMotion }) {
        return {
          async newPage() {
            return {
              setDefaultTimeout() {},
              on() {},
              async goto() {
                if (reducedMotion === 'reduce') await failSecondNavigation.promise;
                throw reducedMotion === 'reduce' ? second : first;
              },
              async screenshot() {
                captures.push(reducedMotion);
                if (reducedMotion === 'no-preference') {
                  firstCapturing.resolve();
                  await finishFirstCapture.promise;
                }
              },
            };
          },
          async close() {
            closing.push(reducedMotion);
          },
        };
      },
    };
    const run = await actualBrowserProof();
    const frontier = initialFrontier();
    const records = [];
    const work = run(browser, 'http://controlled', {}, 'out', records, [], frontier, []);
    const rejection = work.result.catch((error) => error);
    await firstCapturing.promise;
    const prematureCommonSnapshot = frontier.failureSnapshot;
    failSecondNavigation.resolve();
    const caught = await rejection;
    const winningSnapshot = frontier.failureSnapshot;
    const capture = await actualCallerCatch();
    const receipt = {};
    const primary = capture(
      receipt,
      caught,
      'browser',
      [],
      frontier,
      records,
      browserFailureFrontier,
    );
    finishFirstCapture.resolve();
    const settled = await work.settled;
    assert.equal(prematureCommonSnapshot, undefined, 'capture не выбирает общий primary failure');
    assert.equal(caught, second);
    assert.equal(primary, second);
    assert.equal(receipt.failure.stateContinuity, second.stateContinuity);
    assert.equal(receipt.failure.browserFrontier.mode, 'reduce');
    assert.equal(receipt.failure.browserFrontier.stage, 'navigation');
    assert.equal(receipt.failure.browserFrontier.member, null);
    assert.equal(receipt.failure.browserFrontier.completedRecords, 0);
    assert.equal(receipt.failure.browserFrontier.modes.reduce.stage, 'navigation');
    assert.equal(receipt.failure.browserFrontier.modes['no-preference'].stage, 'failure-capture');
    assert.ok(Object.isFrozen(winningSnapshot));
    assert.ok(Object.isFrozen(winningSnapshot.modes.reduce));
    assert.deepEqual(captures, ['no-preference', 'reduce']);
    assert.deepEqual(closing, ['reduce', 'no-preference']);
    assert.equal(settled[0].reason, first);
    assert.equal(settled[1].reason, second);
    assert.equal(
      frontier.failureSnapshot,
      winningSnapshot,
      'late sibling не заменяет winning snapshot',
    );
    assert.deepEqual(receipt.failure.browserFrontier, winningSnapshot);
    assert.notEqual(receipt.failure.browserFrontier, winningSnapshot);
    assert.equal(Object.hasOwn(first, 'browserFrontier'), false);
    assert.equal(Object.hasOwn(second, 'browserFrontier'), false);
  });
}

test('настоящий mode отвергает здоровый proof при отказе закрытия context', async () => {
  const source = await readFile(packedUrl, 'utf8');
  const start = source.indexOf("    } finally {\n      mark('context-close');");
  const cleanupEnd = source.indexOf('\n    }\n    if (contextCloseFailure)', start);
  const end = source.indexOf('\n  };', cleanupEnd);
  assert.ok(start >= 0 && cleanupEnd > start && end > cleanupEnd);
  const finalize = new AsyncFunction(
    'context',
    'cleanupErrors',
    'mark',
    `let contextCloseFailure;\n${source.slice(start + '    } finally {'.length, cleanupEnd)}${source.slice(cleanupEnd + '\n    }'.length, end)}`,
  );
  const original = new Error('controlled finalizer failure');
  const cleanupErrors = [];
  await assert.rejects(
    finalize(
      {
        async close() {
          throw original;
        },
      },
      cleanupErrors,
      (stage) => assert.equal(stage, 'context-close'),
    ),
    (error) => error === original,
  );
  assert.deepEqual(cleanupErrors, [String(original)]);
});

test('failed receipt сохраняет отдельный snapshot cleanupErrors до позднего callback', async () => {
  const source = await readFile(packedUrl, 'utf8');
  const start = source.indexOf('    if (cleanupErrors.length) {');
  const end = source.indexOf('    receipt.completed =', start);
  assert.ok(start >= 0 && end > start);
  const finalize = new Function('cleanupErrors', 'receipt', source.slice(start, end));
  const errors = ['context close failed'];
  const receipt = { outcome: 'passed' };
  finalize(errors, receipt);
  errors.push('late context close failed');
  assert.equal(receipt.outcome, 'failed');
  assert.deepEqual(receipt.cleanupErrors, ['context close failed']);
});

test('оба независимых режима начинают работу до завершения любого из них', async () => {
  const started = [];
  const releases = {};
  const records = [];
  const frontier = initialFrontier();
  const work = browserProofModes(
    async (mode, completed, progress) => {
      started.push(mode);
      progress.stage = mode === 'reduce' ? 'annulus' : 'width-motion';
      completed.push({ name: `${mode}:first` });
      await new Promise((resolve) => {
        releases[mode] = resolve;
      });
      completed.push({ name: `${mode}:last` });
    },
    browserProofRecords(records, frontier, () => 100),
    frontier,
    () => 100,
  );
  await Promise.resolve();
  assert.deepEqual(started, ['no-preference', 'reduce']);
  assert.equal(records.length, 2);
  const full = frontier.modes['no-preference'];
  const reduced = frontier.modes.reduce;
  assert.notEqual(full.frontier, reduced.frontier);
  assert.notEqual(full.records, reduced.records);
  assert.equal(full.records.length, 1);
  assert.equal(reduced.records.length, 1);
  const failure = browserProofTimeout(frontier, records, 120000).browserFrontier;
  assert.equal(failure.elapsedMs, 120000);
  assert.equal(failure.modes['no-preference'].elapsedMs, 120000);
  assert.equal(failure.modes.reduce.elapsedMs, 120000);
  assert.equal(failure.modes['no-preference'].stage, 'width-motion');
  assert.equal(failure.modes.reduce.stage, 'annulus');
  assert.equal(failure.modes['no-preference'].lastCompletedRecord, 'no-preference:first');
  assert.equal(failure.modes.reduce.lastCompletedRecord, 'reduce:first');
  releases.reduce();
  releases['no-preference']();
  await work.result;
  assert.ok((await work.settled).every((result) => result.status === 'fulfilled'));
  assert.equal(records.length, 4);
  assert.equal(full.records.length, 2);
  assert.equal(reduced.records.length, 2);
  assert.equal(failure.completedRecords, 2, 'timeout snapshot не меняется после завершения');
});

test('первый отказ сохраняется, а sibling остаётся в settlement до своего finally', async () => {
  const original = new Error('controlled original failure');
  let release;
  let completed = false;
  const work = browserProofModes(
    async (mode) => {
      if (mode === 'no-preference') throw original;
      try {
        await new Promise((resolve) => {
          release = resolve;
        });
      } finally {
        completed = true;
      }
    },
    [],
    initialFrontier(),
  );
  await assert.rejects(work.result, (error) => error === original);
  assert.equal(completed, false);
  release();
  const results = await work.settled;
  assert.equal(results[0].reason, original);
  assert.equal(results[1].status, 'fulfilled');
  assert.equal(completed, true);
});

test('cleanup ждёт settlement после закрытия браузера и снимает свой timer', async () => {
  const events = [];
  let release;
  const settled = new Promise((resolve) => {
    release = resolve;
  });
  const cleanup = closeBrowserProof(
    {
      close: async () => {
        events.push('browser-close');
      },
    },
    { settled },
    {
      setTimeout(_callback, delay) {
        assert.equal(delay, 20_000);
        return 'cleanup-timer';
      },
      clearTimeout(timer) {
        assert.equal(timer, 'cleanup-timer');
        events.push('timer-cleared');
      },
    },
  );
  await Promise.resolve();
  events.push('before-settlement');
  release();
  assert.deepEqual(await cleanup, { settled: true, errors: [] });
  events.push('receipt-ready');
  assert.deepEqual(events, [
    'browser-close',
    'before-settlement',
    'timer-cleared',
    'receipt-ready',
  ]);
});

test('отказ close и зависший sibling завершают cleanup явным ограниченным отказом', async () => {
  const original = new Error('controlled close failure');
  let timeout;
  let release;
  const settled = new Promise((resolve) => {
    release = resolve;
  });
  const cleanup = closeBrowserProof(
    {
      close: async () => {
        throw original;
      },
    },
    { settled },
    {
      setTimeout(callback, delay) {
        assert.equal(delay, 20_000);
        timeout = callback;
        return 1;
      },
      clearTimeout(timer) {
        assert.equal(timer, 1);
      },
    },
  );
  await Promise.resolve();
  timeout();
  const result = await cleanup;
  assert.deepEqual(result, {
    settled: false,
    errors: [String(original), 'Browser proof cleanup timeout after 20000ms'],
  });
  release();
  await settled;
  assert.equal(result.settled, false);
  assert.equal(result.errors.length, 2);
});

test('даже незавершившийся transport close не оставляет cleanup без срока', async () => {
  let timeout;
  let release;
  const closing = new Promise((resolve) => {
    release = resolve;
  });
  const cleanup = closeBrowserProof(
    { close: () => closing },
    { settled: Promise.resolve() },
    {
      setTimeout(callback, delay) {
        assert.equal(delay, 20_000);
        timeout = callback;
        return 1;
      },
      clearTimeout(timer) {
        assert.equal(timer, 1);
      },
    },
  );
  timeout();
  assert.deepEqual(await cleanup, {
    settled: false,
    errors: ['Browser proof cleanup timeout after 20000ms'],
  });
  release();
  await closing;
});

test('неполный cleanup замораживает records до записи failed receipt', async () => {
  const source = await readFile(packedUrl, 'utf8');
  const start = source.indexOf('    const browserCleanup = await closeBrowserProof(');
  const end = source.indexOf('\n    try {', start);
  assert.ok(start >= 0 && end > start);
  const finalize = new AsyncFunction(
    'closeBrowserProof',
    'browser',
    'proofWork',
    'cleanupErrors',
    'receipt',
    'records',
    source.slice(start, end),
  );
  const records = [{ name: 'accepted', observation: { width: 0.8 } }];
  const receipt = { records };
  const errors = [];
  await finalize(
    async () => ({ settled: false, errors: ['cleanup timeout'] }),
    {},
    {},
    errors,
    receipt,
    records,
  );
  records[0].observation.width = 1;
  records.push({ name: 'late' });
  assert.deepEqual(errors, ['cleanup timeout']);
  assert.deepEqual(receipt.records, [{ name: 'accepted', observation: { width: 0.8 } }]);
});

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
