import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { decodeEvidenceLog, evidenceLog, writeStdout } from '../../../scripts/ci/evidence-log.mjs';
import { png } from './evidence.mjs';

const PREFIX = 'LABUI_SHEET_EVIDENCE';
const MAX_FILE = 4 * 1024 * 1024;
const MAX_JSON = 64 * 1024;
export const CASES = Object.freeze(
  ['Light', 'Dark'].flatMap((theme) =>
    ['Blur', 'Solid'].map((material) =>
      Object.freeze({ name: `${theme}-${material}`, theme, material }),
    ),
  ),
);
const FILES = Object.freeze([
  'identity.json',
  ...CASES.flatMap(({ name }) => [`${name}.json`, `${name}.png`]),
]);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const source = (value) => assert.match(value, /^[a-f0-9]{40}$/, 'sheet: source SHA');
const parse = (bytes) => {
  assert.ok(bytes.length > 0 && bytes.length <= MAX_JSON, 'sheet: размер JSON');
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
};
const near = (actual, expected) =>
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) <= 0.01,
    'sheet: геометрия вне эталона',
  );
const known = (value, values) => (values.includes(value) ? value : null);
const failurePhases = [
  'identity',
  'observation',
  'render',
  'capability',
  'readiness',
  'geometry',
  'window-before',
  'screenshot',
  'window-after',
  'cleanup',
];
function errorInfo(value) {
  if (value == null) return null;
  // Ни префикс сообщения, ни форма строки не разрешают публиковать текст исключения.
  return {
    type: known(value.name, ['Error', 'AssertionError', 'SyntaxError', 'TypeError', 'RangeError']),
    code: known(value.code, [
      'ERR_ASSERTION',
      'SHEET_HOST_REQUIRED',
      'ETIMEDOUT',
      'ENOENT',
      'EACCES',
      'EPERM',
      'ESRCH',
      'EIO',
      'ENOBUFS',
      'EPIPE',
      'ABORT_ERR',
      'ERR_INVALID_ARG_TYPE',
      'ERR_INVALID_ARG_VALUE',
      'ERR_ENCODING_INVALID_ENCODED_DATA',
    ]),
  };
}

export function validateObservation(value, expected) {
  let phase = 'identity';
  try {
    assert.ok(Number.isSafeInteger(expected.pid) && expected.pid > 0);
    assert.ok(
      Number.isSafeInteger(expected.startedAtUnixMs) &&
        expected.startedAtUnixMs > 0 &&
        Number.isSafeInteger(expected.observedUntilUnixMs) &&
        expected.observedUntilUnixMs >= expected.startedAtUnixMs,
      'sheet: временные границы процесса',
    );
    assert.equal(value.pid, expected.pid, 'sheet: PID наблюдения');
    assert.ok(
      Number.isSafeInteger(value.observedAtUnixMs) &&
        value.observedAtUnixMs >= expected.startedAtUnixMs &&
        value.observedAtUnixMs <= expected.observedUntilUnixMs,
      'sheet: время наблюдения',
    );
    assert.equal(typeof value.windowHandle, 'string');
    assert.match(value.windowHandle, /^[1-9][0-9]{0,18}$/, 'sheet: HWND');
    assert.ok(BigInt(value.windowHandle) <= 0x7fffffffffffffffn, 'sheet: HWND range');
    if (expected.windowHandle !== undefined)
      assert.equal(value.windowHandle, expected.windowHandle, 'sheet: HWND identity');
    assert.equal(value.theme, expected.theme, 'sheet: тема');
    assert.equal(value.requestedMaterial, expected.material, 'sheet: запрошенный материал');
    phase = 'render';
    assert.equal(value.error, null, 'sheet: ошибка renderer');
    assert.equal(value.rendererReady, true, 'sheet: rendererReady');
    phase = 'capability';
    assert.equal(value.effectiveMaterial, expected.material, 'sheet: исполненный материал');
    phase = 'readiness';
    for (const field of ['layoutReady', 'imageLoaded'])
      assert.equal(value[field], true, `sheet: ${field}`);
    phase = 'geometry';
    // Этот статический эталон квалифицируется при 100% DPI; остальные масштабы остаются отдельной проверкой.
    assert.equal(value.rasterizationScale, 1, 'sheet: reference DPI');
    for (const [part, bounds] of Object.entries({
      viewport: { x: 0, y: 0, width: 375, height: 812 },
      body: { x: 0, y: 390, width: 375, height: 422 },
      handle: { x: 170, y: 404, width: 36, height: 4 },
    }))
      for (const [field, expectedValue] of Object.entries(bounds))
        near(value[part]?.[field], expectedValue);
  } catch (error) {
    error.sheetPhase = phase;
    throw error;
  }
  return value;
}

function validate(files, sourceSha) {
  source(sourceSha);
  assert.deepEqual([...files.keys()].sort(), [...FILES].sort(), 'sheet: полный набор файлов');
  for (const [file, bytes] of files)
    assert.ok(
      Buffer.isBuffer(bytes) &&
        bytes.length > 0 &&
        bytes.length <= (file.endsWith('.png') ? MAX_FILE : MAX_JSON),
      'sheet: размер файла',
    );
  const identity = parse(files.get('identity.json'));
  assert.equal(identity.source, sourceSha, 'sheet: source identity');
  for (const field of [
    'appSha256',
    'consumerSha256',
    'uiSha256',
    'motionSha256',
    'cliZipSha256',
    'cliSha256',
  ]) {
    assert.match(identity[field], /^[a-f0-9]{64}$/, `sheet: ${field}`);
  }
  assert.equal(identity.visualReview, 'pending');
  assert.equal(identity.motion, 'not-qualified');
  assert.equal(identity.performance, 'not-qualified');
  assert.deepEqual(Object.keys(identity.cases).sort(), CASES.map(({ name }) => name).sort());
  for (const entry of CASES) {
    const owner = identity.cases[entry.name];
    assert.equal(owner.exited, true, 'sheet: собственный процесс не завершён');
    assert.equal(typeof owner.windowHandle, 'string', 'sheet: HWND процесса');
    const observation = validateObservation(parse(files.get(`${entry.name}.json`)), {
      ...owner,
      ...entry,
    });
    assert.deepEqual(owner.windowBefore, owner.windowAfter, 'sheet: окно изменилось при захвате');
    assert.equal(owner.windowBefore.pid, owner.pid, 'sheet: native PID');
    assert.equal(owner.windowBefore.windowHandle, owner.windowHandle, 'sheet: native HWND');
    assert.ok(
      Number.isSafeInteger(owner.windowBefore.startedAtUnixMs) &&
        owner.windowBefore.startedAtUnixMs > 0 &&
        owner.windowBefore.startedAtUnixMs <= observation.observedAtUnixMs,
      'sheet: native start time',
    );
    assert.deepEqual(
      png(files.get(`${entry.name}.png`)),
      { width: 375, height: 812 },
      'sheet: размер снимка',
    );
  }
}

export function encodeSheetEvidence(files, sourceSha) {
  validate(files, sourceSha);
  return [...files]
    .map(([file, bytes]) => evidenceLog(bytes, PREFIX, { sourceSha, file }, 'sha256'))
    .join('');
}

export function decodeSheetEvidence(log, sourceSha) {
  source(sourceSha);
  assert.ok(Buffer.byteLength(log, 'utf8') <= 32 * 1024 * 1024, 'sheet: размер журнала');
  const files = new Map();
  for (const { metadata, bytes } of decodeEvidenceLog(log, PREFIX, {
    digestField: 'sha256',
    maxBytes: MAX_FILE,
    maxPackets: FILES.length,
    maxTotalBytes: MAX_FILE * 4 + MAX_JSON * 5,
  })) {
    assert.equal(metadata.sourceSha, sourceSha, 'sheet: packet source');
    assert.ok(
      FILES.includes(metadata.file) && !files.has(metadata.file),
      'sheet: неизвестный/повторный файл',
    );
    files.set(metadata.file, bytes);
  }
  validate(files, sourceSha);
  return files;
}

export function sheetFailureLog({
  sourceSha,
  name,
  phase,
  pid,
  observation,
  error,
  cleanupError,
  stderrBytes,
}) {
  source(sourceSha);
  assert.ok(
    CASES.some((entry) => entry.name === name),
    'sheet: failure case',
  );
  const number = (value) => (Number.isFinite(value) ? value : null);
  let readback = null;
  if (observation !== null && typeof observation === 'object') {
    readback = {
      pid: number(observation.pid),
      windowHandle:
        typeof observation.windowHandle === 'string' &&
        /^[0-9]{1,19}$/.test(observation.windowHandle)
          ? observation.windowHandle
          : null,
      observedAtUnixMs: number(observation.observedAtUnixMs),
      theme: known(observation.theme, ['Light', 'Dark', 'Default']),
      rasterizationScale: number(observation.rasterizationScale),
      requestedMaterial: known(observation.requestedMaterial, ['Blur', 'Solid']),
      effectiveMaterial: known(observation.effectiveMaterial, ['Blur', 'Solid']),
      materialReason: known(observation.materialReason, [
        'Requested',
        'TransparencyDisabled',
        'EffectsUnsupported',
        'EffectsNotFast',
      ]),
      error:
        observation.error === null
          ? null
          : typeof observation.error === 'string'
            ? 'reported'
            : 'invalid',
    };
    for (const field of ['layoutReady', 'imageLoaded', 'rendererReady'])
      readback[field] = typeof observation[field] === 'boolean' ? observation[field] : null;
    for (const part of ['viewport', 'body', 'handle'])
      readback[part] =
        observation[part] !== null && typeof observation[part] === 'object'
          ? Object.fromEntries(
              ['x', 'y', 'width', 'height'].map((field) => [
                field,
                number(observation[part][field]),
              ]),
            )
          : null;
  }
  return `LABUI_SHEET_FAILURE_JSON ${JSON.stringify({
    source: sourceSha,
    name,
    phase: known(error?.sheetPhase, failurePhases) ?? known(phase, failurePhases),
    pid: number(pid),
    observation: readback,
    error: errorInfo(error),
    cleanupError: errorInfo(cleanupError),
    stderrBytes: number(stderrBytes),
  })}\n`;
}

async function within(promise, milliseconds, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function readWindow(pid) {
  assert.ok(Number.isSafeInteger(pid) && pid > 0);
  // Читается только собственный PID; инвентаризация и выбор чужих окон не нужны.
  const script = `$ErrorActionPreference = 'Stop'
$sheetProcess = [Diagnostics.Process]::GetProcessById(${pid})
try {
  $sheetProcess.Refresh()
  if ($sheetProcess.HasExited) { throw 'Sheet process exited' }
  [pscustomobject]@{
    pid = $sheetProcess.Id
    windowHandle = $sheetProcess.MainWindowHandle.ToInt64().ToString()
    startedAtUnixMs = ([DateTimeOffset]$sheetProcess.StartTime.ToUniversalTime()).ToUnixTimeMilliseconds()
  } | ConvertTo-Json -Compress
} finally { $sheetProcess.Dispose() }`;
  const result = spawnSync('pwsh', ['-NoProfile', '-Command', script], {
    encoding: 'utf8',
    timeout: 10000,
    maxBuffer: MAX_JSON,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, 'sheet: OS window readback отказал');
  const value = JSON.parse(result.stdout);
  assert.equal(value.pid, pid, 'sheet: OS window PID');
  assert.match(value.windowHandle, /^[1-9][0-9]{0,18}$/, 'sheet: OS window HWND');
  assert.ok(
    Number.isSafeInteger(value.startedAtUnixMs) && value.startedAtUnixMs > 0,
    'sheet: OS process start',
  );
  return value;
}

async function captureCase(appDirectory, output, cli, entry, sourceSha) {
  const observationPath = join(output, `${entry.name}.json`);
  const startedAtUnixMs = Date.now();
  const args = [
    '--sheet',
    ...(entry.theme === 'Dark' ? ['--dark'] : []),
    ...(entry.material === 'Solid' ? ['--solid'] : []),
  ];
  const child = spawn(join(appDirectory, 'Buttons.exe'), args, {
    cwd: appDirectory,
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, LABUI_SHEET_OBSERVATION: observationPath },
  });
  let childError;
  let stderrBytes = 0;
  child.on('error', (error) => {
    childError = error;
  });
  child.stderr.on('data', (chunk) => {
    stderrBytes += chunk.length;
    if (stderrBytes > MAX_JSON) {
      childError = new Error('sheet: stderr превысил лимит');
      child.kill();
    }
  });
  const closed = new Promise((done) =>
    child.once('close', (code, signal) => done({ code, signal })),
  );
  let observed;
  let result;
  let failure;
  let cleanupError;
  let phase = 'readiness';
  try {
    const deadline = startedAtUnixMs + 20000;
    while (Date.now() < deadline) {
      if (childError) throw childError;
      assert.equal(child.exitCode, null, 'sheet: приложение завершилось до снимка');
      try {
        phase = 'observation';
        assert.ok((await lstat(observationPath)).size <= MAX_JSON, 'sheet: размер наблюдения');
        observed = parse(await readFile(observationPath));
        break;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      phase = 'readiness';
      await delay(50);
    }
    assert.ok(observed, 'sheet: приложение не доставило готовую геометрию за 20 секунд');
    validateObservation(observed, {
      ...entry,
      pid: child.pid,
      startedAtUnixMs,
      observedUntilUnixMs: Date.now(),
    });
    phase = 'window-before';
    const windowBefore = readWindow(child.pid);
    assert.equal(
      windowBefore.windowHandle,
      observed.windowHandle,
      'sheet: HWND принадлежит другому окну',
    );
    assert.ok(
      windowBefore.startedAtUnixMs <= observed.observedAtUnixMs,
      'sheet: процесс создан после наблюдения',
    );
    phase = 'screenshot';
    const pngPath = join(output, `${entry.name}.png`);
    const command = spawnSync(
      cli,
      ['ui', 'screenshot', 'Sheet', '--output', pngPath, '-w', observed.windowHandle, '--json'],
      {
        encoding: 'utf8',
        timeout: 15000,
        maxBuffer: MAX_JSON,
        windowsHide: true,
        env: {
          ...process.env,
          WINAPP_UI_WORKFLOW_ID: randomUUID(),
          WINAPP_CLI_TELEMETRY_OPTOUT: '1',
          WINAPP_CLI_UPDATE_CHECK: '0',
        },
      },
    );
    if (command.error) throw command.error;
    assert.equal(command.status, 0, 'sheet: screenshot отказал');
    const reply = JSON.parse(command.stdout);
    assert.ok(reply !== null && typeof reply === 'object', 'sheet: CLI screenshot не вернул JSON');
    await delay(0);
    if (childError) throw childError;
    assert.equal(child.exitCode, null, 'sheet: приложение завершилось во время снимка');
    assert.deepEqual(png(await readFile(pngPath)), { width: 375, height: 812 });
    phase = 'window-after';
    const windowAfter = readWindow(child.pid);
    assert.deepEqual(windowAfter, windowBefore, 'sheet: окно изменилось во время снимка');
    result = {
      pid: child.pid,
      startedAtUnixMs,
      observedUntilUnixMs: Date.now(),
      windowHandle: observed.windowHandle,
      windowBefore,
      windowAfter,
    };
  } catch (error) {
    failure = error;
  } finally {
    try {
      if (child.exitCode === null && child.signalCode === null) child.kill();
      const termination = await within(closed, 5000, 'sheet: собственный процесс не завершился');
      if (result) Object.assign(result, { exited: true, termination });
    } catch (error) {
      if (failure) cleanupError = error;
      else {
        failure = error;
        phase = 'cleanup';
      }
    }
  }
  if (failure) {
    await writeStdout(
      sheetFailureLog({
        sourceSha,
        name: entry.name,
        phase,
        pid: child.pid,
        observation: observed,
        error: failure,
        cleanupError,
        stderrBytes,
      }),
    );
    throw new Error('sheet: capture отказал; подробности в LABUI_SHEET_FAILURE_JSON');
  }
  return result;
}

async function capture(appDirectory, output, receiptPath, sourceSha) {
  if (
    !(
      process.platform === 'win32' &&
      process.env.GITHUB_ACTIONS === 'true' &&
      process.env.RUNNER_ENVIRONMENT === 'github-hosted'
    )
  )
    throw Object.assign(new Error('sheet: capture требует GitHub hosted Windows'), {
      code: 'SHEET_HOST_REQUIRED',
    });
  source(sourceSha);
  const receipt = parse(await readFile(receiptPath));
  const cliBytes = await readFile(receipt.path);
  assert.equal(hash(cliBytes), receipt.executableSha256, 'sheet: WinApp executable identity');
  assert.equal(
    hash(await readFile(receipt.archivePath)),
    receipt.archiveSha256,
    'sheet: WinApp archive identity',
  );
  const identity = {
    source: sourceSha,
    cases: {},
    cliVersion: receipt.version,
    cliZipSha256: receipt.archiveSha256,
    cliSha256: receipt.executableSha256,
    visualReview: 'pending',
    motion: 'not-qualified',
    performance: 'not-qualified',
  };
  for (const [field, file] of Object.entries({
    appSha256: 'Buttons.exe',
    consumerSha256: 'Buttons.dll',
    uiSha256: 'LabUI.WinUI.dll',
    motionSha256: 'LabMotion.WinUI.dll',
  }))
    identity[field] = hash(await readFile(join(appDirectory, file)));
  await mkdir(output);
  for (const entry of CASES)
    identity.cases[entry.name] = await captureCase(
      appDirectory,
      output,
      receipt.path,
      entry,
      sourceSha,
    );
  await writeFile(join(output, 'identity.json'), JSON.stringify(identity, null, 2), { flag: 'wx' });
  const files = new Map(
    await Promise.all(FILES.map(async (file) => [file, await readFile(join(output, file))])),
  );
  await writeStdout(encodeSheetEvidence(files, sourceSha));
}

async function main([operation, ...args]) {
  if (operation === 'capture' && args.length === 4)
    await capture(resolve(args[0]), resolve(args[1]), resolve(args[2]), args[3]);
  else if (operation === 'decode' && args.length === 3) {
    assert.ok((await lstat(args[0])).size <= 32 * 1024 * 1024, 'sheet: размер журнала');
    const files = decodeSheetEvidence(
      new TextDecoder('utf8', { fatal: true }).decode(await readFile(args[0])),
      args[1],
    );
    await mkdir(args[2]);
    for (const [file, bytes] of files) await writeFile(join(args[2], file), bytes, { flag: 'wx' });
    await writeFile(
      join(args[2], 'manifest.json'),
      JSON.stringify(
        [...files].map(([file, bytes]) => ({ file, sha256: hash(bytes) })),
        null,
        2,
      ),
      { flag: 'wx' },
    );
  } else
    throw new Error(
      'Usage: sheet.mjs capture <app-directory> <new-output> <winapp-receipt> <source-sha> | decode <job.log> <source-sha> <new-output>',
    );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`LABUI_SHEET_ERROR_JSON ${JSON.stringify(errorInfo(error))}\n`);
    process.exitCode = 1;
  }
}
