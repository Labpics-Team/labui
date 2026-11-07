import assert from 'node:assert/strict';
import { test } from 'node:test';
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
