import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';
import { evidenceLog } from '../../../scripts/ci/evidence-log.mjs';
import {
  CASES,
  decodeSheetEvidence,
  encodeSheetEvidence,
  sheetFailureLog,
  validateObservation,
} from './sheet.mjs';

const SOURCE = 'a'.repeat(40);
const CLI = fileURLToPath(new URL('./sheet.mjs', import.meta.url));
const json = (value) => Buffer.from(JSON.stringify(value));
const processIdentity = { pid: 42, startedAtUnixMs: 100, observedUntilUnixMs: 200 };
const EXPECTED_CASES = [
  { name: 'Light-Blur', theme: 'Light', material: 'Blur' },
  { name: 'Light-Solid', theme: 'Light', material: 'Solid' },
  { name: 'Dark-Blur', theme: 'Dark', material: 'Blur' },
  { name: 'Dark-Solid', theme: 'Dark', material: 'Solid' },
];

function observation(theme = 'Light', material = 'Blur') {
  return {
    pid: 42,
    windowHandle: '1234',
    observedAtUnixMs: 150,
    theme,
    rasterizationScale: 1,
    viewport: { x: 0, y: 0, width: 375, height: 812 },
    body: { x: 0, y: 390, width: 375, height: 422 },
    handle: { x: 170, y: 404, width: 36, height: 4 },
    layoutReady: true,
    imageLoaded: true,
    rendererReady: true,
    requestedMaterial: material,
    effectiveMaterial: material,
    materialReason: null,
    error: null,
  };
}

function png() {
  const chunk = (name, payload) => {
    const bytes = Buffer.alloc(12 + payload.length);
    bytes.writeUInt32BE(payload.length);
    bytes.write(name, 4, 'ascii');
    payload.copy(bytes, 8);
    bytes.writeUInt32BE(crc32(bytes.subarray(4, -4)), bytes.length - 4);
    return bytes;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(375);
  header.writeUInt32BE(812, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.alloc((375 * 4 + 1) * 812))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function fixture() {
  const identity = {
    source: SOURCE,
    cases: {},
    visualReview: 'pending',
    motion: 'not-qualified',
    performance: 'not-qualified',
  };
  for (const field of [
    'appSha256',
    'consumerSha256',
    'uiSha256',
    'motionSha256',
    'cliZipSha256',
    'cliSha256',
  ])
    identity[field] = 'b'.repeat(64);
  const files = new Map();
  for (const { name, theme, material } of EXPECTED_CASES) {
    const window = { pid: 42, windowHandle: '1234', startedAtUnixMs: 110 };
    identity.cases[name] = {
      ...processIdentity,
      windowHandle: '1234',
      exited: true,
      windowBefore: window,
      windowAfter: window,
    };
    files.set(`${name}.json`, json(observation(theme, material)));
    files.set(`${name}.png`, png());
  }
  files.set('identity.json', json(identity));
  return files;
}

const rawPackets = (files) =>
  [...files]
    .map(([file, bytes]) =>
      evidenceLog(bytes, 'LABUI_SHEET_EVIDENCE', { sourceSha: SOURCE, file }, 'sha256'),
    )
    .join('');

test('Half observation admits the reference and rejects wrong process, stale readiness and changed geometry', () => {
  const expected = { ...CASES[0], ...processIdentity };
  validateObservation(observation(), expected);
  for (const change of [
    { pid: 43 },
    { observedAtUnixMs: 99 },
    { observedAtUnixMs: 201 },
    { windowHandle: '0' },
    { windowHandle: 1234 },
    { theme: 'Dark' },
    { effectiveMaterial: 'Solid' },
    { error: 'device lost' },
    { layoutReady: false },
    { imageLoaded: false },
    { rendererReady: false },
    { rasterizationScale: 1.5 },
    { body: { x: 0, y: 406, width: 375, height: 406 } },
    { handle: { x: 170, y: 404, width: 36, height: 0 } },
  ])
    assert.throws(() => validateObservation({ ...observation(), ...change }, expected));
});

test('all four materials retain exact bytes and source through the common log codec', () => {
  assert.deepEqual(CASES, EXPECTED_CASES);
  const files = fixture();
  const decoded = decodeSheetEvidence(encodeSheetEvidence(files, SOURCE), SOURCE);
  assert.deepEqual(decoded, files);
  assert.throws(() => decodeSheetEvidence(rawPackets(files), 'c'.repeat(40)));
});

test('failed capture preserves bounded source and capability diagnostics without becoming evidence', () => {
  const observed = {
    ...observation(),
    effectiveMaterial: 'Solid',
    materialReason: 'EffectsNotFast',
    privateEnvironment: { token: 'not-for-job-log' },
  };
  let primary;
  try {
    validateObservation(observed, { ...EXPECTED_CASES[0], ...processIdentity });
  } catch (error) {
    primary = error;
  }
  assert.ok(primary);
  const line = sheetFailureLog({
    sourceSha: SOURCE,
    name: 'Light-Blur',
    phase: 'observation',
    pid: 42,
    observation: observed,
    error: primary,
    cleanupError: new Error('sheet: cleanup deadline'),
    stderrBytes: 17,
    stderr: 'not-for-job-log',
  });
  const value = JSON.parse(line.slice('LABUI_SHEET_FAILURE_JSON '.length));
  assert.equal(value.source, SOURCE);
  assert.equal(value.name, 'Light-Blur');
  assert.equal(value.phase, 'capability');
  assert.equal(value.pid, 42);
  assert.equal(value.observation.effectiveMaterial, 'Solid');
  assert.equal(value.observation.materialReason, 'EffectsNotFast');
  assert.match(value.error, /исполненный материал/);
  assert.equal(value.cleanupError, 'sheet: cleanup deadline');
  assert.equal(value.stderrBytes, 17);
  assert.doesNotMatch(line, /not-for-job-log|privateEnvironment|"stderr"/);
  assert.throws(() => decodeSheetEvidence(line, SOURCE));
  const partial = new Map([['Light-Blur.json', json(observed)]]);
  assert.throws(() => decodeSheetEvidence(line + rawPackets(partial), SOURCE));
  const malformed = sheetFailureLog({
    sourceSha: SOURCE,
    name: 'Light-Blur',
    phase: 'readiness',
    pid: 42,
    observation: null,
    error: new SyntaxError('not-for-job-log'),
    stderrBytes: 0,
  });
  const absent = JSON.parse(malformed.slice('LABUI_SHEET_FAILURE_JSON '.length));
  assert.equal(absent.phase, 'readiness');
  assert.equal(absent.observation, null);
  assert.doesNotMatch(malformed, /not-for-job-log/);
  const oversized = sheetFailureLog({
    sourceSha: SOURCE,
    name: 'Light-Blur',
    phase: 'render',
    pid: 42,
    observation: { ...observed, error: 'x'.repeat(64000) },
    error: new Error(`sheet: ${'x'.repeat(64000)}`),
    stderrBytes: 0,
  });
  assert.ok(Buffer.byteLength(oversized) < 8192);
  for (const [phase, change] of [
    ['render', { error: 'device lost' }],
    ['render', { rendererReady: false }],
    ['readiness', { imageLoaded: false }],
    ['readiness', { layoutReady: false }],
    ['geometry', { rasterizationScale: 1.5 }],
    ['geometry', { body: { x: 0, y: 406, width: 375, height: 406 } }],
  ]) {
    assert.throws(
      () =>
        validateObservation(
          { ...observation(), ...change },
          { ...EXPECTED_CASES[0], ...processIdentity },
        ),
      (error) => error.sheetPhase === phase,
    );
  }
});

test('incomplete, duplicate, foreign, corrupted or unqualified evidence cannot be published', () => {
  const complete = fixture();
  for (const file of complete.keys()) {
    const partial = new Map(complete);
    partial.delete(file);
    assert.throws(() => encodeSheetEvidence(partial, SOURCE));
    assert.throws(() => decodeSheetEvidence(rawPackets(partial), SOURCE));
  }
  const foreign = new Map(complete);
  foreign.set('../escape.json', json({}));
  assert.throws(() => decodeSheetEvidence(rawPackets(foreign), SOURCE));
  const repeated =
    rawPackets(complete) +
    rawPackets(new Map([['Light-Blur.json', complete.get('Light-Blur.json')]]));
  assert.throws(() => decodeSheetEvidence(repeated, SOURCE));
  const corrupt = new Map(complete);
  corrupt.set('Light-Blur.png', png().subarray(0, -1));
  assert.throws(() => decodeSheetEvidence(rawPackets(corrupt), SOURCE));
  const wrongPid = new Map(complete);
  wrongPid.set('Light-Blur.json', json({ ...observation(), pid: 43 }));
  assert.throws(() => decodeSheetEvidence(rawPackets(wrongPid), SOURCE));
  for (const changedOwner of [
    { startedAtUnixMs: null },
    { observedUntilUnixMs: '200' },
    { windowHandle: undefined },
    { windowAfter: { pid: 42, windowHandle: '5678', startedAtUnixMs: 110 } },
    { windowAfter: { pid: 42, windowHandle: '1234', startedAtUnixMs: 111 } },
  ]) {
    const files = new Map(complete);
    const identity = JSON.parse(files.get('identity.json'));
    Object.assign(identity.cases['Light-Blur'], changedOwner);
    files.set('identity.json', json(identity));
    assert.throws(() => decodeSheetEvidence(rawPackets(files), SOURCE));
  }
});

test('real CLI decodes once and refuses local native capture before creating output', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'labui-sheet-codec-'));
  try {
    const log = join(directory, 'job.log');
    await writeFile(log, rawPackets(fixture()));
    const decoded = join(directory, 'decoded');
    const run = (args, env = process.env) =>
      spawnSync(process.execPath, [CLI, ...args], {
        encoding: 'utf8',
        env,
        windowsHide: true,
        timeout: 10000,
      });
    const first = run(['decode', log, SOURCE, decoded]);
    assert.equal(first.status, 0, first.stderr);
    assert.deepEqual(await readFile(join(decoded, 'Light-Blur.png')), png());
    assert.notEqual(run(['decode', log, SOURCE, decoded]).status, 0);
    const local = join(directory, 'local');
    const denied = run(['capture', directory, local, log, SOURCE], {
      ...process.env,
      GITHUB_ACTIONS: 'false',
      RUNNER_ENVIRONMENT: '',
    });
    assert.notEqual(denied.status, 0);
    assert.match(denied.stderr, /GitHub hosted Windows/);
    await assert.rejects(readFile(join(local, 'identity.json')), { code: 'ENOENT' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
