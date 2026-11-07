import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sheetMaterialPixelFailures, sheetMaterialPixels } from './sheet-material-pixels.mjs';
import { sheetFailureLog } from './sheet.mjs';

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
function materialImage({ ghost = 'sharp', coloredBody = false } = {}) {
  const rgb = new Uint8Array(375 * 812 * 3);
  for (let y = 0; y < 812; y++)
    for (let x = 0; x < 375; x++) {
      const offset = (y * 375 + x) * 3;
      const band = Math.floor(x / 75);
      const checker = Math.floor(y / 27) % 2 ? 30 : -30;
      for (let channel = 0; channel < 3; channel++) {
        let value = 100 + band * 10 + checker;
        if (y < 390 && ghost === 'shift') value++;
        if (y < 390 && ghost === 'smooth')
          value = 100 + band * 10 + 30 * (1 - y / 390) * Math.sin((y * Math.PI) / 27);
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
    [{ ghost: 'smooth' }, 'Body', 'Ghost'],
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
      sheetMaterialPixels(materialImage({ ghost: 'smooth', coloredBody: true }), materialImage()),
    ),
    [],
  );
});
