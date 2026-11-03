import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { evidenceLog } from '../../../scripts/ci/evidence-log.mjs';
import { EVIDENCE_FILES, decodeNativeEvidence, encodeNativeEvidence } from './evidence.mjs';

const SOURCE = 'a'.repeat(40);
const PREFIX = 'LABUI_NATIVE_EVIDENCE';
// Однопиксельный PNG проверяет доставку, а не renderer продукта.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);
const json = (value) => Buffer.from(`${JSON.stringify(value)}\n`);
const pngNames = EVIDENCE_FILES.filter((file) => file.endsWith('.png'));
const CLI = fileURLToPath(new URL('./evidence.mjs', import.meta.url));

function fixture() {
  const paint = { width: 1, height: 1, medianRgb: [1, 2, 3] };
  return new Map([
    ...pngNames.map((file) => [file, PNG]),
    [
      'identity.json',
      json({
        source: SOURCE,
        appSha256: '1'.repeat(64),
        consumerSha256: '5'.repeat(64),
        uiSha256: '2'.repeat(64),
        motionSha256: '3'.repeat(64),
        cliZipSha256: '4'.repeat(64),
      }),
    ],
    [
      'result.json',
      json({ passed: true, visualReview: 'pending', motionLifetime: 'not-qualified' }),
    ],
    [
      'theme-pixels.json',
      json({
        Small: { light: paint, dark: paint },
        Medium: { light: paint, dark: paint },
        Large: { light: paint, dark: paint },
      }),
    ],
    ['commands.json', json([{ name: 'fixture', arguments: ['click'], exitCode: 0 }])],
    ['close.json', json({ exited: true, exitCode: 0 })],
  ]);
}

// Независимая сборка пакетов допускает преднамеренно неверный native payload.
function rawPackets(files, sourceSha = SOURCE) {
  return [...files]
    .map(([file, bytes]) => evidenceLog(bytes, PREFIX, { file, sourceSha }, 'sha256'))
    .join('');
}

test('native allowlist round-trip preserves all 14 exact files and source identity', () => {
  const files = fixture();
  const log = encodeNativeEvidence(files, SOURCE);
  assert.deepEqual(decodeNativeEvidence(log, SOURCE), files);
  assert.equal([...decodeNativeEvidence(log, SOURCE)].length, 14);
  assert.throws(() => decodeNativeEvidence(log, 'b'.repeat(40)), /packet source/);
  assert.throws(() => encodeNativeEvidence(files, 'b'.repeat(40)), /identity source/);
});

test('missing, repeated and unauthorized files fail with intact valid neighbours', () => {
  for (const file of EVIDENCE_FILES) {
    const files = fixture();
    files.delete(file);
    assert.throws(() => encodeNativeEvidence(files, SOURCE), /набор файлов/);
    assert.throws(() => decodeNativeEvidence(rawPackets(files), SOURCE), /набор файлов/);
  }
  const files = fixture();
  files.delete('focus.png');
  files.set('../focus.png', PNG);
  assert.throws(() => decodeNativeEvidence(rawPackets(files), SOURCE), /неизвестный файл/);
  files.delete('../focus.png');
  const repeated =
    rawPackets(files) +
    evidenceLog(PNG, PREFIX, { file: 'page-Light.png', sourceSha: SOURCE }, 'sha256');
  assert.throws(() => decodeNativeEvidence(repeated, SOURCE), /повторный файл/);
});

test('managed consumer identity is required independently of the apphost', () => {
  for (const digest of [undefined, null, '', 'not-a-digest', 'g'.repeat(64)]) {
    const files = fixture();
    const identity = JSON.parse(files.get('identity.json'));
    identity.consumerSha256 = digest;
    files.set('identity.json', json(identity));
    assert.throws(() => encodeNativeEvidence(files, SOURCE), /identity consumerSha256/);
    assert.throws(() => decodeNativeEvidence(rawPackets(files), SOURCE), /identity consumerSha256/);
  }
  const files = fixture();
  assert.deepEqual(decodeNativeEvidence(encodeNativeEvidence(files, SOURCE), SOURCE), files);
});

test('native validates PNG chunks, byte bounds and JSON outcomes on both boundaries', () => {
  const badCrc = Buffer.from(PNG);
  badCrc[45] ^= 1;
  const mutations = [
    ['Light-Small.png', badCrc],
    ['Light-Small.png', PNG.subarray(0, -12)],
    ['Light-Small.png', Buffer.concat([PNG, Buffer.from([0])])],
    ['Light-Small.png', Buffer.alloc(4 * 1024 * 1024 + 1)],
    ['identity.json', json({ source: 'b'.repeat(40) })],
    ['identity.json', Buffer.from([0xff])],
    ['result.json', json({ passed: false })],
    ['result.json', Buffer.from('null')],
    ['result.json', Buffer.alloc(256 * 1024 + 1, 32)],
    ['close.json', json({ exited: false, exitCode: 0 })],
    ['close.json', json({ exited: true, exitCode: 1 })],
    ['commands.json', json([])],
    ['commands.json', json([{ name: 'failed', arguments: [], exitCode: 1 }])],
    [
      'theme-pixels.json',
      json({ Small: { light: { width: 2, height: 1, medianRgb: [1, 2, 3] } } }),
    ],
  ];
  for (const [file, bytes] of mutations) {
    const files = fixture();
    files.set(file, bytes);
    assert.throws(() => encodeNativeEvidence(files, SOURCE), file);
    assert.throws(() => decodeNativeEvidence(rawPackets(files), SOURCE), file);
  }
});

test('complete CLI export and timestamped decode preserve files; missing input exports nothing', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'labui-native-evidence-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const files = fixture();
  for (const [file, bytes] of files) await writeFile(join(directory, file), bytes);
  const exported = spawnSync(process.execPath, [CLI, 'export', directory, SOURCE], {
    encoding: 'utf8',
  });
  assert.equal(exported.status, 0, exported.stderr);
  const log = exported.stdout
    .trimEnd()
    .split('\n')
    .map((line) => `2026-11-03T05:50:07.9850450Z ${line}`)
    .join('\n');
  const input = join(directory, 'job.log');
  const output = join(directory, 'decoded');
  // Windows PowerShell 5 Set-Content -Encoding utf8 добавляет BOM.
  await writeFile(input, `\uFEFF${log}`);
  const decoded = spawnSync(process.execPath, [CLI, 'decode', input, SOURCE, output], {
    encoding: 'utf8',
  });
  assert.equal(decoded.status, 0, decoded.stderr);
  for (const [file, bytes] of files) assert.deepEqual(await readFile(join(output, file)), bytes);
  const manifest = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'));
  assert.equal(manifest.sourceSha, SOURCE);
  assert.equal(manifest.files.length, 14);
  const again = spawnSync(process.execPath, [CLI, 'decode', input, SOURCE, output], {
    encoding: 'utf8',
  });
  assert.notEqual(again.status, 0, 'readback must not overwrite prior evidence');
  await rm(join(directory, 'focus.png'));
  const incomplete = spawnSync(process.execPath, [CLI, 'export', directory, SOURCE], {
    encoding: 'utf8',
  });
  assert.notEqual(incomplete.status, 0);
  assert.equal(incomplete.stdout, '', 'неполный набор не публикует часть packets');
});

test('workflow requires successful export and includes transport contracts', async () => {
  const text = await readFile(
    new URL('../../../.github/workflows/native.yml', import.meta.url),
    'utf8',
  );
  const validate = (workflow) => {
    const step = workflow.slice(
      workflow.indexOf('      - name: Export native evidence to job log'),
    );
    assert.match(step, /node native\/windows\/test\/evidence\.mjs export/);
    assert.match(step, /if \(\$LASTEXITCODE -ne 0\) \{ throw 'Native evidence export failed\.'/);
    assert.doesNotMatch(step, /continue-on-error:|if:/);
    assert.match(
      workflow,
      /node --test .*scripts\/ci\/evidence-log\.test\.mjs .*native\/windows\/test\/evidence\.test\.mjs/,
    );
  };
  validate(text);
  assert.throws(() =>
    validate(text.replace('node native/windows/test/evidence.mjs export', 'echo omitted')),
  );
  assert.throws(() =>
    validate(
      text.replace(
        '      - name: Export native evidence to job log',
        '      - name: Export native evidence to job log\n        continue-on-error: true',
      ),
    ),
  );
});
