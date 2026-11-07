import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { crc32, deflateSync } from 'node:zlib';
import { sheetMaterialPixelFailures, sheetMaterialPixels } from './sheet-material-pixels.mjs';
import {
  decodeSheetEvidence,
  encodeSheetCaptureEvidence,
  encodeSheetEvidence,
  sheetFailureLog,
} from './sheet.mjs';

// Инертный replay JSON-диагностики; native capture и runner fixtures не запускаются.
const record = (value = {}) =>
  JSON.parse(
    sheetFailureLog({
      sourceSha: 'a'.repeat(40),
      name: 'Content-List',
      phase: 'screenshot-image',
      pid: 42,
      observation: null,
      error: new assert.AssertionError({ message: 'PRIVATE_CAPTURE_TEXT' }),
      stderrBytes: 0,
      ...value,
    }).slice('LABUI_SHEET_FAILURE_JSON '.length),
  );

test('screenshot failure retains command status and measured dimensions', () => {
  const value = record({
    screenshot: {
      exitCode: 0,
      replyIsObject: true,
      image: { width: 375, height: 749 },
      stdout: 'PRIVATE_CAPTURE_TEXT',
    },
  });
  assert.equal(value.phase, 'screenshot-image');
  assert.deepEqual(value.screenshot, {
    exitCode: 0,
    replyIsObject: true,
    image: { width: 375, height: 749 },
  });
  assert.ok(!JSON.stringify(value).includes('PRIVATE_CAPTURE_TEXT'));
  for (const phase of ['screenshot-command', 'screenshot-reply', 'screenshot-process'])
    assert.equal(record({ phase }).phase, phase);
});

test('screenshot diagnostics discard corrupt shapes and unbounded fields', () => {
  assert.equal(record({ screenshot: ['PRIVATE_CAPTURE_TEXT'] }).screenshot, null);
  for (const exitCode of [Number.POSITIVE_INFINITY, '0', -2147483649, 4294967296, 0.5]) {
    const value = record({
      screenshot: {
        exitCode,
        replyIsObject: 'true',
        image: { width: -375, height: '812', message: 'PRIVATE_CAPTURE_TEXT' },
      },
    });
    assert.deepEqual(value.screenshot, {
      exitCode: null,
      replyIsObject: null,
      image: { width: null, height: null },
    });
    assert.ok(!JSON.stringify(value).includes('PRIVATE_CAPTURE_TEXT'));
  }
});

test('failures before screenshot preserve the existing record shape', () => {
  const value = record({ phase: 'render' });
  assert.equal(value.phase, 'render');
  assert.equal(Object.hasOwn(value, 'screenshot'), false);
  assert.equal(record({ phase: 'screenshot' }).phase, 'screenshot');
});

// Самостоятельные RGB контрпримеры проверяют PNG consumer; WinUI не исполняется.
function materialImage({ ghost = 'sharp', coloredBody = false, veilColor = 127 } = {}) {
  const rgb = new Uint8Array(375 * 812 * 3);
  const checkerAt = (y) => (Math.floor(y / 27) % 2 ? 30 : -30);
  // Пространственная свёртка checker; каждый output читает соседние source rows.
  const blurredRows = Array.from({ length: 390 }, (_, y) => {
    if (ghost !== 'convolution') return 0;
    const sigma = 0.5 + y / 50;
    let weighted = 0;
    let weight = 0;
    for (let offset = -Math.ceil(3 * sigma); offset <= Math.ceil(3 * sigma); offset++) {
      const kernel = Math.exp(-(offset * offset) / (2 * sigma * sigma));
      weighted += checkerAt(y + offset) * kernel;
      weight += kernel;
    }
    return weighted / weight;
  });
  for (let y = 0; y < 812; y++)
    for (let x = 0; x < 375; x++) {
      const offset = (y * 375 + x) * 3;
      const band = Math.floor(x / 75);
      const checker = checkerAt(y);
      for (let channel = 0; channel < 3; channel++) {
        let value = 100 + band * 10 + checker;
        if (y < 390 && ghost === 'shift') value++;
        if (y < 390 && ghost === 'convolution') value = 100 + band * 10 + blurredRows[y];
        if (y < 390 && ghost === 'veil') value = veilColor + (value - veilColor) * (1 - y / 390);
        if (y >= 390)
          value =
            100 +
            ((x * 7 + y * 11) % 5) +
            (coloredBody ? (channel === band % 3 ? 60 : band * 5) : 0);
        rgb[offset + channel] = Math.round(value);
      }
    }
  return { width: 375, height: 812, rgb };
}

test('material pixels reject absent Ghost and neutral noisy Body independently', () => {
  const sharp = materialImage();
  const report = sheetMaterialPixels(sharp, sharp);
  assert.equal(report.ghostChangedPixels, 0);
  assert.ok(sheetMaterialPixelFailures(report).some((failure) => failure.startsWith('Ghost')));
  assert.ok(sheetMaterialPixelFailures(report).some((failure) => failure.startsWith('Body')));
  for (const [options, missing, present] of [
    [{ coloredBody: true }, 'Ghost', 'Body'],
    [{ ghost: 'convolution' }, 'Body', 'Ghost'],
  ]) {
    const failures = sheetMaterialPixelFailures(sheetMaterialPixels(materialImage(options), sharp));
    assert.ok(failures.some((failure) => failure.startsWith(missing)));
    assert.ok(!failures.some((failure) => failure.startsWith(present)));
  }
});

test('changed Ghost pixels alone do not prove blur or progressive detail loss', () => {
  const report = sheetMaterialPixels(
    materialImage({ ghost: 'shift', coloredBody: true }),
    materialImage(),
  );
  assert.ok(report.ghostChangedPixels > 0);
  assert.ok(sheetMaterialPixelFailures(report).some((failure) => failure.startsWith('Ghost')));
  // Инертный пригодный вход доказывает только работоспособность consumer, не native GREEN.
  assert.deepEqual(
    sheetMaterialPixelFailures(
      sheetMaterialPixels(
        materialImage({ ghost: 'convolution', coloredBody: true }),
        materialImage(),
      ),
    ),
    [],
  );
});

test('progressive pointwise veils retain sharp edge shape despite declining gradient energy', () => {
  for (const veilColor of [0, 127, 255]) {
    const report = sheetMaterialPixels(
      materialImage({ ghost: 'veil', coloredBody: true, veilColor }),
      materialImage(),
    );
    assert.ok(report.ghostChangedPixels > 0);
    assert.ok(report.ghostBottomDetailRatio < 1);
    assert.ok(report.ghostBottomDetailRatio < report.ghostTopDetailRatio);
    assert.ok(
      sheetMaterialPixelFailures(report).some((failure) =>
        failure.includes('spatial checker-edge'),
      ),
      `pointwise veil ${veilColor} passed as spatial blur`,
    );
  }
});

function materialPng(image, filter = 0) {
  const chunk = (name, payload) => {
    const bytes = Buffer.alloc(payload.length + 12);
    bytes.writeUInt32BE(payload.length);
    bytes.write(name, 4, 'ascii');
    payload.copy(bytes, 8);
    bytes.writeUInt32BE(crc32(bytes.subarray(4, -4)), bytes.length - 4);
    return bytes;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(image.width);
  header.writeUInt32BE(image.height, 4);
  header[8] = 8;
  header[9] = 2;
  const stride = image.width * 3 + 1;
  const raw = Buffer.alloc(stride * image.height);
  for (let y = 0; y < image.height; y++) {
    raw[y * stride] = filter;
    raw.set(image.rgb.subarray(y * image.width * 3, (y + 1) * image.width * 3), y * stride + 1);
  }
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const SOURCE = 'a'.repeat(40);
const json = (value) => Buffer.from(JSON.stringify(value));
function materialFiles({
  Light = 'convolution',
  Dark = 'convolution',
  coloredBody = true,
  areEffectsFast = false,
} = {}) {
  // Девять инертных файлов production DTO; runner/environment fixtures здесь отсутствуют.
  const identity = {
    source: SOURCE,
    cases: {},
    cliVersion: '0.7.1',
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
  for (const theme of ['Light', 'Dark'])
    for (const material of ['Blur', 'Solid']) {
      const name = `${theme}-${material}`;
      const window = { pid: 42, windowHandle: '1234', startedAtUnixMs: 110 };
      identity.cases[name] = {
        pid: 42,
        startedAtUnixMs: 100,
        observedUntilUnixMs: 200,
        windowHandle: '1234',
        exited: true,
        windowBefore: window,
        windowAfter: window,
      };
      files.set(
        `${name}.json`,
        json({
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
          requestedState: 'Half',
          requestedMaterial: material,
          effectiveMaterial: material,
          materialReason: 'Requested',
          materialCapabilities: {
            advancedEffectsEnabled: true,
            areEffectsSupported: true,
            areEffectsFast,
          },
          error: null,
        }),
      );
      files.set(
        `${name}.png`,
        materialPng(
          materialImage({
            ghost: material === 'Blur' ? { Light, Dark }[theme] : 'sharp',
            coloredBody: material === 'Blur' && coloredBody,
          }),
        ),
      );
    }
  files.set('identity.json', json(identity));
  return files;
}

test('the production material helper preserves exact codec bytes after PNG assertions', (t) => {
  const files = materialFiles();
  const checkedStart = performance.now();
  const evidence = encodeSheetCaptureEvidence(files, SOURCE);
  const checkedMs = performance.now() - checkedStart;
  const structuralStart = performance.now();
  const structural = encodeSheetEvidence(files, SOURCE);
  const structuralMs = performance.now() - structuralStart;
  assert.equal(evidence, structural);
  assert.deepEqual(decodeSheetEvidence(evidence, SOURCE), files);
  t.diagnostic(JSON.stringify({ inertSingleSample: { checkedMs, structuralMs, decodedPngs: 4 } }));
});

test('production publication rejects absent or veiled Ghost in each theme without changing historical decoding', () => {
  for (const theme of ['Light', 'Dark'])
    for (const ghost of ['sharp', 'veil']) {
      const files = materialFiles({ [theme]: ghost });
      assert.deepEqual(decodeSheetEvidence(encodeSheetEvidence(files, SOURCE), SOURCE), files);
      assert.throws(
        () => encodeSheetCaptureEvidence(files, SOURCE),
        new RegExp(`sheet: ${theme} PNG:.*Ghost`),
      );
    }
  const files = materialFiles({ coloredBody: false });
  assert.deepEqual(decodeSheetEvidence(encodeSheetEvidence(files, SOURCE), SOURCE), files);
  assert.throws(() => encodeSheetCaptureEvidence(files, SOURCE), /Body loses the colored source/);
});

test('Fast false and null never bypass the production Blur PNG assertions', () => {
  for (const areEffectsFast of [true, false, null]) {
    const positive = materialFiles({ areEffectsFast });
    assert.deepEqual(
      decodeSheetEvidence(encodeSheetCaptureEvidence(positive, SOURCE), SOURCE),
      positive,
    );
    for (const theme of ['Light', 'Dark']) {
      const files = materialFiles({ [theme]: 'veil', areEffectsFast });
      assert.throws(
        () => encodeSheetCaptureEvidence(files, SOURCE),
        new RegExp(`sheet: ${theme} PNG:`),
      );
    }
  }
});

test('production publication rejects incomplete maps, malformed JSON and invalid PNG pixels', () => {
  const positive = materialFiles();
  for (const file of positive.keys()) {
    const files = new Map(positive);
    files.delete(file);
    assert.throws(() => encodeSheetCaptureEvidence(files, SOURCE), /полный набор файлов/);
  }
  for (const [file, bytes] of [
    ['Light-Blur.json', Buffer.from('{')],
    ['Dark-Solid.png', Buffer.from('invalid PNG')],
  ]) {
    const files = new Map(positive).set(file, bytes);
    assert.throws(() => encodeSheetCaptureEvidence(files, SOURCE));
  }
  const invalidPixels = new Map(positive).set('Dark-Blur.png', materialPng(materialImage(), 5));
  assert.deepEqual(
    decodeSheetEvidence(encodeSheetEvidence(invalidPixels, SOURCE), SOURCE),
    invalidPixels,
  );
  assert.throws(() => encodeSheetCaptureEvidence(invalidPixels, SOURCE), /неизвестный фильтр 5/);
});

test('pixel publication retains material equality and capability requirements while Solid fallback stays readable', () => {
  for (const theme of ['Light', 'Dark']) {
    const name = `${theme}-Blur.json`;
    for (const change of [
      { effectiveMaterial: 'Solid' },
      {
        materialCapabilities: {
          advancedEffectsEnabled: true,
          areEffectsSupported: false,
          areEffectsFast: false,
        },
      },
      {
        materialCapabilities: {
          advancedEffectsEnabled: false,
          areEffectsSupported: true,
          areEffectsFast: false,
        },
      },
    ]) {
      const files = materialFiles();
      files.set(name, json({ ...JSON.parse(files.get(name)), ...change }));
      assert.throws(
        () => encodeSheetCaptureEvidence(files, SOURCE),
        (error) => error.sheetPhase === 'capability',
      );
    }
  }
  const fallback = materialFiles();
  for (const theme of ['Light', 'Dark']) {
    const name = `${theme}-Solid.json`;
    fallback.set(
      name,
      json({
        ...JSON.parse(fallback.get(name)),
        materialReason: 'EffectsUnsupported',
        materialCapabilities: {
          advancedEffectsEnabled: false,
          areEffectsSupported: false,
          areEffectsFast: false,
        },
      }),
    );
  }
  assert.deepEqual(decodeSheetEvidence(encodeSheetEvidence(fallback, SOURCE), SOURCE), fallback);
  assert.deepEqual(
    decodeSheetEvidence(encodeSheetCaptureEvidence(fallback, SOURCE), SOURCE),
    fallback,
  );
});

test('material capture publishes through the PNG assertion after gathering the complete map', async () => {
  // Лексический guard реального capture: процесс, env и runner boundary не исполняются.
  const source = await readFile(new URL('./sheet.mjs', import.meta.url), 'utf8');
  const capture = source.slice(
    source.indexOf('async function capture('),
    source.indexOf('async function main('),
  );
  const assertPublication = (candidate) => {
    assert.match(candidate, /const files = new Map\(\s*await Promise\.all\(/);
    assert.match(
      candidate,
      /await writeStdout\(\s*content\s*\? encode\(files, sourceSha, true\)\s*:\s*encodeSheetCaptureEvidence\(files, sourceSha\),?\s*\);/,
    );
    assert.ok(
      candidate.indexOf('const files = new Map(') < candidate.indexOf('await writeStdout('),
    );
  };
  assertPublication(capture);
  assert.throws(() =>
    assertPublication(
      capture.replace('encodeSheetCaptureEvidence(files, sourceSha)', 'encode(files, sourceSha)'),
    ),
  );
});
