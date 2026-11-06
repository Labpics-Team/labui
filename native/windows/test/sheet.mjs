import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { decodeEvidenceLog, evidenceLog, writeStdout } from '../../../scripts/ci/evidence-log.mjs';
import { png } from './evidence.mjs';
import {
  CONTENT_SCHEMA,
  CONTENT_CASES as SCROLL_CONTENT_CASES,
  contentReadback,
  validateContentWitness,
} from './sheet-content.mjs';
import { POLICY_CASES, policyReadback, validatePolicyWitness } from './sheet-policy.mjs';
import { validateWindowGeometry, windowGeometryReadback } from './sheet-window-geometry.mjs';

export const CONTENT_CASES = Object.freeze([...SCROLL_CONTENT_CASES, ...POLICY_CASES]);

const PREFIX = 'LABUI_SHEET_EVIDENCE';
const CONTENT_PREFIX = 'LABUI_SHEET_CONTENT_EVIDENCE';
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
const CONTENT_FILES = Object.freeze([
  'identity.json',
  ...CONTENT_CASES.flatMap(({ name }) => [`${name}.json`, `${name}.png`]),
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
  'content-layout',
  'content-scroll',
  'content-template',
  'window-before',
  'screenshot',
  'screenshot-command',
  'screenshot-reply',
  'screenshot-process',
  'screenshot-image',
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

function topologyInfo(value) {
  if (!Array.isArray(value) || value.length > 20) return null;
  const integer = (value, minimum, maximum) =>
    Number.isInteger(value) && value >= minimum && value <= maximum ? value : null;
  const boolean = (value) => (typeof value === 'boolean' ? value : null);
  const sigmaList = (value) =>
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 2 &&
    [...value].every(
      (sigma) =>
        typeof sigma === 'number' &&
        sigma >= 0 &&
        Number.isFinite(sigma) &&
        Number.isFinite(Math.fround(sigma)),
    )
      ? [...value]
      : null;
  return value.map((input) => {
    const row = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    return {
      index: integer(row.index, 0, 19),
      inputs: integer(row.inputs, 1, 8),
      combine: known(row.combine, ['Add', 'Arithmetic', 'BalancedAdd', 'Gaussian']),
      source: known(row.source, ['shared', 'repeat', 'distinct']),
      named: boolean(row.named),
      blur: boolean(row.blur),
      mask: boolean(row.mask),
      ...(Object.hasOwn(row, 'stage') ? { stage: known(row.stage, ['build', 'factory']) } : {}),
      ...(Object.hasOwn(row, 'levelStart') ? { levelStart: integer(row.levelStart, 0, 7) } : {}),
      ...(Object.hasOwn(row, 'sigmas') ? { sigmas: sigmaList(row.sigmas) } : {}),
      hresult: integer(row.hresult, -2147483648, 2147483647),
      cleanupHresult: integer(row.cleanupHresult, -2147483648, 2147483647),
    };
  });
}

// Временная метка отказа; снять после RCA и проверенного исправления у renderer.
function factoryInfo(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  if (
    Object.keys(value).length !== 2 ||
    !Object.hasOwn(value, 'name') ||
    !Object.hasOwn(value, 'operation')
  )
    return null;
  const name = known(value.name, [
    'ghostPair0',
    'ghostPair1',
    'ghostPair2',
    'ghostPair3',
    'progressive',
    'ghost',
    'body',
    'final',
  ]);
  const operation = known(value.operation, ['factory', 'brush', 'binding']);
  return name !== null && operation !== null ? { name, operation } : null;
}

function branchesInfo(value) {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const integerOrNull = (input) =>
    input === null || (Number.isInteger(input) && input >= -2147483648 && input <= 2147483647);
  const rows = [];
  for (const row of value) {
    if (
      row === null ||
      typeof row !== 'object' ||
      Array.isArray(row) ||
      Object.keys(row).length !== 2 ||
      !Object.hasOwn(row, 'hresult') ||
      !Object.hasOwn(row, 'cleanupHresult') ||
      !integerOrNull(row.hresult) ||
      !integerOrNull(row.cleanupHresult)
    )
      return null;
    rows.push({ hresult: row.hresult, cleanupHresult: row.cleanupHresult });
  }
  return rows;
}

function observationError(value) {
  if (value === null) return null;
  if (typeof value === 'string') return 'reported';
  if (typeof value !== 'object' || Array.isArray(value)) return 'invalid';
  return {
    origin: known(value.origin, ['image', 'unhandled']),
    type: known(value.type, [
      'COMException',
      'ArgumentException',
      'ArgumentOutOfRangeException',
      'InvalidOperationException',
      'ObjectDisposedException',
      'FileNotFoundException',
      'IOException',
      'NotSupportedException',
      'NullReferenceException',
      'TypeLoadException',
      'OutOfMemoryException',
      'UnauthorizedAccessException',
      'AggregateException',
      'Exception',
    ]),
    hresult:
      Number.isInteger(value.hresult) && value.hresult >= -2147483648 && value.hresult <= 2147483647
        ? value.hresult
        : null,
    ...(Object.hasOwn(value, 'site')
      ? {
          site: known(value.site, [
            'Compositor.CreateEffectFactory',
            'Compositor.CreateBackdropBrush',
            'Compositor.CreateSurfaceBrush',
            'Compositor.CreateSpriteVisual',
            'CompositionEffectFactory.CreateBrush',
            'CompositionEffectBrush.SetSourceParameter',
            'CompositionGraphicsDevice.CreateDrawingSurface',
            'CompositionGraphicsDevice.CreateVirtualDrawingSurface',
            'CanvasComposition.CreateCompositionGraphicsDevice',
            'CanvasComposition.CreateDrawingSession',
            'CanvasDevice.GetSharedDevice',
            'CanvasBitmap.CreateFromBytes',
            'CanvasDrawingSession.CreateLayer',
            'CanvasDrawingSession.DrawImage',
            'CanvasDrawingSession.DrawGeometry',
            'CanvasDrawingSession.FillGeometry',
            'CanvasDrawingSession.FillRectangle',
            'CanvasDrawingSession.Dispose',
            'CanvasGeometry.CreatePath',
            'CanvasGeometry.CreateRectangle',
            'CanvasGeometry.CombineWith',
            'CanvasPathBuilder.AddArc',
            'CanvasLinearGradientBrush.ctor',
            'GaussianBlurEffect.BlurAmount',
            'GaussianBlurEffect.Source',
            'GaussianBlurEffect.BorderMode',
            'OpacityEffect.Opacity',
            'OpacityEffect.Source',
            'BlendEffect.Mode',
            'BlendEffect.Background',
            'BlendEffect.Foreground',
            'CompositeEffect.Mode',
            'ArithmeticCompositeEffect.Source1',
            'ArithmeticCompositeEffect.Source2',
            'ArithmeticCompositeEffect.MultiplyAmount',
            'ArithmeticCompositeEffect.Source1Amount',
            'ArithmeticCompositeEffect.Source2Amount',
            'ArithmeticCompositeEffect.Offset',
            'AlphaMaskEffect.Source',
            'AlphaMaskEffect.AlphaMask',
            'SheetLayers.Surface',
            'SheetLayers.BuildFrame',
            'SheetLayers.BodyShape',
            'SheetLayers.DrawShadows',
            'SheetLayers.DrawNoise',
            'SheetLayers.DrawAtlasCell',
            'SheetLayers.Render',
          ]),
        }
      : {}),
    ...(Object.hasOwn(value, 'topology') ? { topology: topologyInfo(value.topology) } : {}),
    ...(Object.hasOwn(value, 'factory') ? { factory: factoryInfo(value.factory) } : {}),
    ...(Object.hasOwn(value, 'branches') ? { branches: branchesInfo(value.branches) } : {}),
    ...(Object.hasOwn(value, 'clamping') ? { clamping: branchesInfo(value.clamping) } : {}),
    ...(Object.hasOwn(value, 'sigma') ? { sigma: branchesInfo(value.sigma) } : {}),
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
    if (Object.hasOwn(value, 'windowGeometry')) {
      const descriptor = Object.getOwnPropertyDescriptor(value, 'windowGeometry');
      assert.ok(Object.hasOwn(descriptor, 'value'), 'sheet: windowGeometry JSON');
      validateWindowGeometry(descriptor.value);
    }
    assert.ok(
      value.materialReason === null ||
        ['Requested', 'TransparencyDisabled', 'EffectsUnsupported', 'EffectsNotFast'].includes(
          value.materialReason,
        ),
      'sheet: material reason',
    );
    const policy = POLICY_CASES.find(({ name }) => name === expected.name);
    let bodyHeight = 422;
    if (!policy && expected.scenario === undefined) {
      const optional = [
        'requestedState',
        'geometryScale',
        'contentViewport',
        'contentWitness',
        'windowGeometry',
      ];
      assert.deepEqual(
        Object.keys(value).sort(),
        [
          'pid',
          'windowHandle',
          'observedAtUnixMs',
          'theme',
          'rasterizationScale',
          'viewport',
          'body',
          'handle',
          'layoutReady',
          'imageLoaded',
          'rendererReady',
          'requestedMaterial',
          'effectiveMaterial',
          'materialReason',
          'error',
          ...optional.filter((field) => Object.hasOwn(value, field)),
        ].sort(),
        'sheet: поля наблюдения материала',
      );
      if (Object.hasOwn(value, 'requestedState')) assert.equal(value.requestedState, 'Half');
      if (Object.hasOwn(value, 'geometryScale')) assert.equal(value.geometryScale, 1);
      if (Object.hasOwn(value, 'contentWitness')) assert.equal(value.contentWitness, null);
      if (Object.hasOwn(value, 'contentViewport')) {
        assert.deepEqual(Object.keys(value.contentViewport).sort(), ['height', 'width', 'x', 'y']);
        for (const [field, expectedValue] of Object.entries({
          x: 16,
          y: 438,
          width: 343,
          height: 358,
        }))
          near(value.contentViewport[field], expectedValue);
      }
    }
    if (policy) {
      validatePolicyWitness(value.contentWitness, expected);
      assert.deepEqual(
        Object.keys(value).sort(),
        [
          'pid',
          'windowHandle',
          'observedAtUnixMs',
          'theme',
          'rasterizationScale',
          'viewport',
          'body',
          'handle',
          'layoutReady',
          'imageLoaded',
          'rendererReady',
          'requestedMaterial',
          'requestedState',
          'geometryScale',
          'contentViewport',
          'contentWitness',
          'effectiveMaterial',
          'materialReason',
          'error',
          ...(Object.hasOwn(value, 'windowGeometry') ? ['windowGeometry'] : []),
        ].sort(),
        'sheet policy: поля наблюдения',
      );
      assert.equal(value.requestedState, policy.state);
      assert.equal(value.geometryScale, 1);
      for (const part of ['viewport', 'body', 'handle', 'contentViewport'])
        assert.deepEqual(Object.keys(value[part]).sort(), ['x', 'y', 'width', 'height'].sort());
      const final = value.contentWitness.steps.at(-1);
      if (policy.state === 'Flex') bodyHeight = Math.min(812, 64 + final.root.desired.height);
      near(final.bodyHeight, bodyHeight);
      for (const [field, expectedValue] of Object.entries({
        x: 16,
        y: 812 - bodyHeight + 48,
        width: 343,
        height: bodyHeight - 64,
      }))
        near(value.contentViewport[field], expectedValue);
      near(final.viewport.actualWidth, value.contentViewport.width);
      near(final.viewport.actualHeight, value.contentViewport.height);
    }
    for (const [part, bounds] of Object.entries({
      viewport: { x: 0, y: 0, width: 375, height: 812 },
      body: { x: 0, y: 812 - bodyHeight, width: 375, height: bodyHeight },
      handle: { x: 170, y: 812 - bodyHeight + 14, width: 36, height: 4 },
    })) {
      assert.deepEqual(Object.keys(value[part]).sort(), ['height', 'width', 'x', 'y']);
      for (const [field, expectedValue] of Object.entries(bounds))
        near(value[part]?.[field], expectedValue);
    }
    if (expected.scenario !== undefined && !policy) validateContentWitness(value, expected);
  } catch (error) {
    error.sheetPhase ??= phase;
    throw error;
  }
  return value;
}

function validate(files, sourceSha, content = false) {
  const cases = content ? CONTENT_CASES : CASES;
  const expectedFiles = content ? CONTENT_FILES : FILES;
  source(sourceSha);
  assert.deepEqual(
    [...files.keys()].sort(),
    [...expectedFiles].sort(),
    'sheet: полный набор файлов',
  );
  for (const [file, bytes] of files)
    assert.ok(
      Buffer.isBuffer(bytes) &&
        bytes.length > 0 &&
        bytes.length <= (file.endsWith('.png') ? MAX_FILE : MAX_JSON),
      'sheet: размер файла',
    );
  const identity = parse(files.get('identity.json'));
  assert.equal(identity.source, sourceSha, 'sheet: source identity');
  assert.deepEqual(
    Object.keys(identity).sort(),
    [
      ...(content ? ['schema'] : []),
      'source',
      'cases',
      'cliVersion',
      'cliZipSha256',
      'cliSha256',
      'appSha256',
      'consumerSha256',
      'uiSha256',
      'motionSha256',
      'visualReview',
      'motion',
      'performance',
    ].sort(),
    'sheet: поля identity',
  );
  assert.match(identity.cliVersion, /^v?\d+(?:\.\d+){1,3}(?:[-+][A-Za-z0-9.-]{1,40})?$/);
  if (content) {
    assert.equal(identity.schema, CONTENT_SCHEMA);
  }
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
  assert.deepEqual(Object.keys(identity.cases).sort(), cases.map(({ name }) => name).sort());
  for (const entry of cases) {
    const owner = identity.cases[entry.name];
    assert.deepEqual(
      Object.keys(owner).sort(),
      [
        'pid',
        'startedAtUnixMs',
        'observedUntilUnixMs',
        'windowHandle',
        'windowBefore',
        'windowAfter',
        'exited',
        ...(content || Object.hasOwn(owner, 'termination') ? ['termination'] : []),
      ].sort(),
      'sheet: поля owner',
    );
    for (const window of [owner.windowBefore, owner.windowAfter])
      assert.deepEqual(
        Object.keys(window).sort(),
        ['pid', 'windowHandle', 'startedAtUnixMs'].sort(),
      );
    if (content || Object.hasOwn(owner, 'termination')) {
      assert.deepEqual(Object.keys(owner.termination).sort(), ['code', 'signal']);
      assert.ok(
        owner.termination.code === null ||
          (Number.isInteger(owner.termination.code) &&
            owner.termination.code >= -2147483648 &&
            owner.termination.code <= 2147483647),
      );
      assert.ok(
        [null, 'SIGTERM', 'SIGKILL', 'SIGINT', 'SIGBREAK'].includes(owner.termination.signal),
      );
    }
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
  return encode(files, sourceSha);
}

export function encodeSheetContentEvidence(files, sourceSha) {
  return encode(files, sourceSha, true);
}

function encode(files, sourceSha, content = false) {
  validate(files, sourceSha, content);
  return [...files]
    .map(([file, bytes]) =>
      evidenceLog(bytes, content ? CONTENT_PREFIX : PREFIX, { sourceSha, file }, 'sha256'),
    )
    .join('');
}

export function decodeSheetEvidence(log, sourceSha) {
  return decode(log, sourceSha);
}

export function decodeSheetContentEvidence(log, sourceSha) {
  return decode(log, sourceSha, true);
}

function decode(log, sourceSha, content = false) {
  const expectedFiles = content ? CONTENT_FILES : FILES;
  const count = content ? CONTENT_CASES.length : CASES.length;
  source(sourceSha);
  assert.ok(Buffer.byteLength(log, 'utf8') <= 32 * 1024 * 1024, 'sheet: размер журнала');
  const files = new Map();
  for (const { metadata, bytes } of decodeEvidenceLog(log, content ? CONTENT_PREFIX : PREFIX, {
    digestField: 'sha256',
    maxBytes: MAX_FILE,
    maxPackets: expectedFiles.length,
    maxTotalBytes: MAX_FILE * count + MAX_JSON * (count + 1),
  })) {
    assert.equal(metadata.sourceSha, sourceSha, 'sheet: packet source');
    assert.ok(
      expectedFiles.includes(metadata.file) && !files.has(metadata.file),
      'sheet: неизвестный/повторный файл',
    );
    files.set(metadata.file, bytes);
  }
  validate(files, sourceSha, content);
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
  screenshot,
}) {
  source(sourceSha);
  assert.ok(
    [...CASES, ...CONTENT_CASES].some((entry) => entry.name === name),
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
      ...(Object.hasOwn(observation, 'windowGeometry')
        ? { windowGeometry: windowGeometryReadback(observation.windowGeometry) }
        : {}),
      requestedMaterial: known(observation.requestedMaterial, ['Blur', 'Solid']),
      effectiveMaterial: known(observation.effectiveMaterial, ['Blur', 'Solid']),
      materialReason: known(observation.materialReason, [
        'Requested',
        'TransparencyDisabled',
        'EffectsUnsupported',
        'EffectsNotFast',
      ]),
      error: observationError(observation.error),
      ...(CONTENT_CASES.some((entry) => entry.name === name)
        ? {
            requestedState: known(observation.requestedState, [
              'Full',
              'TwoThirds',
              'Half',
              'OneThird',
              'Flex',
            ]),
            geometryScale: number(observation.geometryScale),
            contentViewport:
              observation.contentViewport !== null &&
              typeof observation.contentViewport === 'object'
                ? Object.fromEntries(
                    ['x', 'y', 'width', 'height'].map((field) => [
                      field,
                      number(observation.contentViewport[field]),
                    ]),
                  )
                : null,
            contentWitness: POLICY_CASES.some((entry) => entry.name === name)
              ? policyReadback(observation.contentWitness)
              : contentReadback(observation.contentWitness),
          }
        : {}),
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
    ...(screenshot === undefined ? {} : { screenshot: screenshotReadback(screenshot) }),
  })}\n`;
}

function screenshotReadback(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const dimension = (value) =>
    Number.isSafeInteger(value) && value > 0 && value <= 1e6 ? value : null;
  return {
    exitCode:
      Number.isInteger(value.exitCode) &&
      value.exitCode >= -2147483648 &&
      value.exitCode <= 4294967295
        ? value.exitCode
        : null,
    replyIsObject: typeof value.replyIsObject === 'boolean' ? value.replyIsObject : null,
    image:
      value.image !== null && typeof value.image === 'object' && !Array.isArray(value.image)
        ? { width: dimension(value.image.width), height: dimension(value.image.height) }
        : null,
  };
}

export function sheetContentCaseLog({ sourceSha, name, pid, windowHandle, exited, observation }) {
  source(sourceSha);
  assert.ok(CONTENT_CASES.some((entry) => entry.name === name));
  assert.ok(Number.isSafeInteger(pid) && pid > 0);
  assert.match(windowHandle, /^[1-9][0-9]{0,18}$/);
  assert.equal(exited, true);
  const payload = JSON.stringify({
    source: sourceSha,
    name,
    pid,
    windowHandle,
    exited,
    contentWitness: POLICY_CASES.some((entry) => entry.name === name)
      ? policyReadback(observation?.contentWitness)
      : contentReadback(observation?.contentWitness),
  });
  assert.ok(Buffer.byteLength(payload, 'utf8') <= MAX_JSON);
  return `LABUI_SHEET_CONTENT_OBSERVATION_JSON ${payload}\n`;
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
    ...(entry.scenario
      ? [
          `--sheet-content=${entry.scenario}`,
          `--sheet-content-alignment=${entry.alignment.toLowerCase()}`,
          '--sheet-content-qualify',
          `--sheet-state=${(entry.state ?? 'Half').toLowerCase()}`,
          '--sheet-scale=1',
        ]
      : []),
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
  let screenshot;
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
    phase = 'screenshot-command';
    screenshot = { exitCode: null, replyIsObject: null, image: null };
    const pngPath = join(output, `${entry.name}.png`);
    const command = spawnSync(
      cli,
      [
        'ui',
        'screenshot',
        'SheetViewport',
        '--output',
        pngPath,
        '-w',
        observed.windowHandle,
        '--json',
      ],
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
    screenshot.exitCode = command.status;
    if (command.error) throw command.error;
    assert.equal(command.status, 0, 'sheet: screenshot отказал');
    phase = 'screenshot-reply';
    const reply = JSON.parse(command.stdout);
    screenshot.replyIsObject = reply !== null && typeof reply === 'object';
    assert.ok(screenshot.replyIsObject, 'sheet: CLI screenshot не вернул JSON');
    phase = 'screenshot-process';
    await delay(0);
    if (childError) throw childError;
    assert.equal(child.exitCode, null, 'sheet: приложение завершилось во время снимка');
    phase = 'screenshot-image';
    screenshot.image = png(await readFile(pngPath));
    assert.deepEqual(screenshot.image, { width: 375, height: 812 });
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
        screenshot,
      }),
    );
    throw new Error('sheet: capture отказал; подробности в LABUI_SHEET_FAILURE_JSON');
  }
  if (entry.scenario)
    await writeStdout(
      sheetContentCaseLog({ sourceSha, name: entry.name, ...result, observation: observed }),
    );
  return result;
}

async function capture(appDirectory, output, receiptPath, sourceSha, content = false) {
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
  if (content) identity.schema = CONTENT_SCHEMA;
  for (const [field, file] of Object.entries({
    appSha256: 'Buttons.exe',
    consumerSha256: 'Buttons.dll',
    uiSha256: 'LabUI.WinUI.dll',
    motionSha256: 'LabMotion.WinUI.dll',
  }))
    identity[field] = hash(await readFile(join(appDirectory, file)));
  await mkdir(output);
  let failedCases = 0;
  for (const entry of content ? CONTENT_CASES : CASES) {
    try {
      identity.cases[entry.name] = await captureCase(
        appDirectory,
        output,
        receipt.path,
        entry,
        sourceSha,
      );
    } catch (error) {
      if (!content) throw error;
      failedCases++;
    }
  }
  if (failedCases > 0)
    throw new Error('sheet: Content witness не прошёл; каждый отказ сохранён отдельно');
  await writeFile(join(output, 'identity.json'), JSON.stringify(identity, null, 2), { flag: 'wx' });
  const files = new Map(
    await Promise.all(
      (content ? CONTENT_FILES : FILES).map(async (file) => [
        file,
        await readFile(join(output, file)),
      ]),
    ),
  );
  await writeStdout(encode(files, sourceSha, content));
}

async function main([operation, ...args]) {
  if (['capture', 'capture-content'].includes(operation) && args.length === 4)
    await capture(
      resolve(args[0]),
      resolve(args[1]),
      resolve(args[2]),
      args[3],
      operation === 'capture-content',
    );
  else if (['decode', 'decode-content'].includes(operation) && args.length === 3) {
    assert.ok((await lstat(args[0])).size <= 32 * 1024 * 1024, 'sheet: размер журнала');
    const files = decode(
      new TextDecoder('utf8', { fatal: true }).decode(await readFile(args[0])),
      args[1],
      operation === 'decode-content',
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
      'Usage: sheet.mjs capture|capture-content <app-directory> <new-output> <winapp-receipt> <source-sha> | decode|decode-content <job.log> <source-sha> <new-output>',
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
