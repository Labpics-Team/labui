import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';
import { decodeEvidenceLog, evidenceLog, writeStdout } from '../../../scripts/ci/evidence-log.mjs';

const PREFIX = 'LABUI_NATIVE_EVIDENCE';
const PNG_MAX_BYTES = 4 * 1024 * 1024;
const JSON_MAX_BYTES = 256 * 1024;
const MAX_TOTAL_BYTES = 16 * 1024 * 1024;
const MAX_LOG_BYTES = 64 * 1024 * 1024;
export const EVIDENCE_FILES = Object.freeze([
  'Light-Small.png',
  'Light-Medium.png',
  'Light-Large.png',
  'Dark-Small.png',
  'Dark-Medium.png',
  'Dark-Large.png',
  'page-Light.png',
  'page-Dark.png',
  'focus.png',
  'identity.json',
  'result.json',
  'theme-pixels.json',
  'commands.json',
  'close.json',
]);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const source = (sha) => assert.match(sha, /^[a-f0-9]{40}$/, 'native: source SHA');

function png(bytes) {
  assert.ok(bytes.length >= 45 && bytes.length <= PNG_MAX_BYTES, 'native: PNG bytes');
  assert.ok(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
  let offset = 8;
  let imageData = false;
  let dimensions;
  while (offset < bytes.length) {
    assert.ok(offset + 12 <= bytes.length, 'native: оборванный PNG chunk');
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    assert.ok(end <= bytes.length, 'native: PNG chunk length');
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    assert.equal(
      crc32(bytes.subarray(offset + 4, end - 4)),
      bytes.readUInt32BE(end - 4),
      'native: PNG CRC',
    );
    if (offset === 8) {
      assert.equal(type, 'IHDR');
      assert.equal(length, 13);
      const width = bytes.readUInt32BE(16);
      const height = bytes.readUInt32BE(20);
      assert.ok(width > 0 && height > 0 && width * height <= 16 * 1024 * 1024);
      dimensions = { width, height };
    } else {
      assert.notEqual(type, 'IHDR', 'native: повторный IHDR');
    }
    if (type === 'IDAT') imageData = true;
    if (type === 'IEND') {
      assert.equal(length, 0);
      assert.equal(end, bytes.length, 'native: данные после IEND');
      assert.ok(imageData, 'native: нет IDAT');
      return dimensions;
    }
    offset = end;
  }
  assert.fail('native: нет IEND');
}

function json(bytes) {
  assert.ok(bytes.length > 0 && bytes.length <= JSON_MAX_BYTES, 'native: JSON bytes');
  const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  assert.ok(value !== null && typeof value === 'object', 'native: JSON object');
  return value;
}

function validate(files, sourceSha) {
  source(sourceSha);
  assert.deepEqual([...files.keys()].sort(), [...EVIDENCE_FILES].sort(), 'native: набор файлов');
  let total = 0;
  const dimensions = new Map();
  const records = new Map();
  for (const [file, bytes] of files) {
    assert.ok(Buffer.isBuffer(bytes));
    total += bytes.length;
    assert.ok(total <= MAX_TOTAL_BYTES, 'native: общий размер');
    if (file.endsWith('.png')) dimensions.set(file, png(bytes));
    else records.set(file, json(bytes));
  }
  const identity = records.get('identity.json');
  assert.equal(identity.source, sourceSha, 'native: identity source');
  for (const field of ['appSha256', 'consumerSha256', 'uiSha256', 'motionSha256', 'cliZipSha256']) {
    assert.match(identity[field], /^[a-f0-9]{64}$/i, `native: identity ${field}`);
  }
  assert.equal(records.get('result.json').passed, true, 'native: smoke не прошёл');
  const close = records.get('close.json');
  assert.equal(close.exited, true, 'native: приложение не завершилось');
  assert.equal(close.exitCode, 0, 'native: приложение завершилось с ошибкой');
  const commands = records.get('commands.json');
  assert.ok(Array.isArray(commands) && commands.length > 0, 'native: нет commands');
  for (const command of commands) {
    assert.equal(typeof command.name, 'string');
    assert.ok(Array.isArray(command.arguments));
    assert.ok(command.arguments.every((argument) => typeof argument === 'string'));
    assert.equal(command.exitCode, 0, 'native: ошибка команды');
  }
  const pixels = records.get('theme-pixels.json');
  for (const size of ['Small', 'Medium', 'Large']) {
    for (const theme of ['Light', 'Dark']) {
      const paint = pixels[size]?.[theme.toLowerCase()];
      const observed = dimensions.get(`${theme}-${size}.png`);
      assert.equal(paint?.width, observed.width, 'native: ширина снимка');
      assert.equal(paint?.height, observed.height, 'native: высота снимка');
      assert.ok(Array.isArray(paint.medianRgb) && paint.medianRgb.length === 3);
      assert.ok(
        paint.medianRgb.every((value) => Number.isInteger(value) && value >= 0 && value <= 255),
      );
    }
  }
  return files;
}

export function encodeNativeEvidence(files, sourceSha) {
  validate(files, sourceSha);
  return EVIDENCE_FILES.map((file) =>
    evidenceLog(files.get(file), PREFIX, { file, sourceSha }, 'sha256'),
  ).join('');
}

export function decodeNativeEvidence(log, sourceSha) {
  source(sourceSha);
  assert.ok(Buffer.byteLength(log, 'utf8') <= MAX_LOG_BYTES, 'native: журнал вне лимита');
  const files = new Map();
  for (const { metadata, bytes } of decodeEvidenceLog(log, PREFIX, {
    digestField: 'sha256',
    maxBytes: PNG_MAX_BYTES,
    maxPackets: EVIDENCE_FILES.length,
    maxTotalBytes: MAX_TOTAL_BYTES,
  })) {
    assert.equal(metadata.sourceSha, sourceSha, 'native: packet source');
    assert.ok(EVIDENCE_FILES.includes(metadata.file), 'native: неизвестный файл');
    assert.ok(!files.has(metadata.file), 'native: повторный файл');
    files.set(metadata.file, bytes);
  }
  return validate(files, sourceSha);
}

async function boundedRead(path, maxBytes) {
  const stat = await lstat(path);
  assert.ok(stat.isFile() && stat.size <= maxBytes, 'native: не файл или превышен размер');
  const bytes = await readFile(path);
  assert.ok(bytes.length <= maxBytes, 'native: размер изменился при чтении');
  return bytes;
}

async function main(args) {
  const [operation, input, sourceSha, output] = args;
  source(sourceSha);
  if (operation === 'export' && args.length === 3) {
    const files = new Map();
    for (const file of EVIDENCE_FILES) {
      files.set(
        file,
        await boundedRead(
          join(resolve(input), file),
          file.endsWith('.png') ? PNG_MAX_BYTES : JSON_MAX_BYTES,
        ),
      );
    }
    await writeStdout(encodeNativeEvidence(files, sourceSha));
  } else if (operation === 'decode' && args.length === 4) {
    const log = new TextDecoder('utf-8', { fatal: true }).decode(
      await boundedRead(resolve(input), MAX_LOG_BYTES),
    );
    const files = decodeNativeEvidence(log, sourceSha);
    const target = resolve(output);
    await mkdir(target);
    for (const [file, bytes] of files) await writeFile(join(target, file), bytes, { flag: 'wx' });
    const manifest = {
      schemaVersion: 1,
      sourceSha,
      files: [...files].map(([file, bytes]) => ({
        file,
        bytes: bytes.length,
        sha256: hash(bytes),
      })),
    };
    await writeFile(join(target, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, {
      flag: 'wx',
    });
    await writeStdout(`native: восстановлено ${files.size} файлов для ${sourceSha}\n`);
  } else {
    throw new Error(
      'Usage: evidence.mjs export <directory> <source-sha> | decode <job.log> <source-sha> <new-directory>',
    );
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
