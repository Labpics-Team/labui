import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';
import { decodeEvidenceLog, evidenceLog, writeStdout } from '../../../scripts/ci/evidence-log.mjs';
import { validateDynamicObservation } from './dynamic-observation.mjs';
import { assertSpaceClockOrigins, validateSpaceObservation } from './space-observation.mjs';

const PREFIX = 'LABUI_NATIVE_EVIDENCE';
const PNG_MAX_BYTES = 4 * 1024 * 1024;
const JSON_MAX_BYTES = 256 * 1024;
const INDEX_MAX_BYTES = 1024 * 1024;
const JPEG_MAX_BYTES = 1024 * 1024;
const MAX_SAMPLES = 2048;
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
  'page-lower-Light.png',
  'page-lower-Dark.png',
  'focus.png',
  'identity.json',
  'result.json',
  'theme-pixels.json',
  'commands.json',
  'close.json',
]);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const source = (sha) => assert.match(sha, /^[a-f0-9]{40}$/, 'native: source SHA');
const modeCheck = (mode) => assert.ok(['idle', 'interaction'].includes(mode), 'native: mode');
const THEMES = ['Light', 'Dark'];
const interactionNames = (theme) => {
  const name = `interaction-${theme}`;
  return [
    `${name}-hover.png`,
    `${name}.mp4`,
    `${name}-record.json`,
    `${name}-window.json`,
    `${name}.frames/manifest.json`,
    `${name}.frames/frames.ndjson`,
  ];
};
const staticFiles = (mode) =>
  mode === 'idle' ? EVIDENCE_FILES : [...EVIDENCE_FILES, ...THEMES.flatMap(interactionNames)];

function fileLimit(file, mode) {
  assert.equal(typeof file, 'string', 'native: имя файла');
  if (
    staticFiles(mode).includes(file) ||
    (mode === 'interaction' && interactionNames('Dynamic').includes(file))
  ) {
    if (file.endsWith('.png') || file.endsWith('.mp4')) return PNG_MAX_BYTES;
    return file.endsWith('.ndjson') ? INDEX_MAX_BYTES : JSON_MAX_BYTES;
  }
  assert.ok(
    mode === 'interaction' &&
      /^interaction-(Light|Dark|Dynamic)\.frames\/frames\/[A-Za-z0-9_-]+\.jpe?g$/.test(file),
    'native: неизвестный файл',
  );
  return JPEG_MAX_BYTES;
}

// Проверяются контейнер и размеры; полноценное декодирование остаётся у capture/просмотра.
function video(bytes) {
  let offset = 0;
  const types = new Set();
  while (offset < bytes.length) {
    assert.ok(offset + 8 <= bytes.length, 'native: оборванный MP4 box');
    let size = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    let header = 8;
    if (size === 1) {
      assert.ok(offset + 16 <= bytes.length, 'native: MP4 extended size');
      const extended = bytes.readBigUInt64BE(offset + 8);
      assert.ok(extended <= BigInt(bytes.length), 'native: MP4 box size');
      size = Number(extended);
      header = 16;
    } else if (size === 0) size = bytes.length - offset;
    assert.ok(size >= header && offset + size <= bytes.length, 'native: MP4 box size');
    if (offset === 0) assert.equal(type, 'ftyp', 'native: MP4 ftyp');
    if (['ftyp', 'moov', 'mdat'].includes(type)) {
      assert.ok(size > header, 'native: пустой MP4 box');
      assert.ok(!types.has(type), 'native: повторный MP4 box');
      types.add(type);
    }
    offset += size;
  }
  assert.deepEqual([...types].sort(), ['ftyp', 'mdat', 'moov'], 'native: неполный MP4');
}

function jpeg(bytes) {
  assert.ok(
    bytes.length > 4 &&
      bytes.readUInt16BE(0) === 0xffd8 &&
      bytes.readUInt16BE(bytes.length - 2) === 0xffd9,
    'native: JPEG boundaries',
  );
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    assert.equal(bytes[offset++], 0xff, 'native: JPEG marker');
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9) break;
    assert.ok(offset + 2 <= bytes.length, 'native: JPEG segment');
    const length = bytes.readUInt16BE(offset);
    assert.ok(length >= 2 && offset + length <= bytes.length - 2, 'native: JPEG length');
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      assert.ok(length >= 8, 'native: JPEG frame header');
      const height = bytes.readUInt16BE(offset + 3);
      const width = bytes.readUInt16BE(offset + 5);
      assert.ok(
        width > 0 && height > 0 && width * height <= 16 * 1024 * 1024,
        'native: JPEG dimensions',
      );
      return { width, height };
    }
    offset += length;
  }
  assert.fail('native: JPEG frame header отсутствует');
}

function frameIndex(bytes) {
  assert.ok(bytes?.length > 0 && bytes.length <= INDEX_MAX_BYTES, 'native: размер индекса');
  const rows = new TextDecoder('utf-8', { fatal: true }).decode(bytes).trimEnd().split(/\r?\n/);
  assert.ok(rows.length >= 10 && rows.length <= MAX_SAMPLES, 'native: число кадров');
  const frames = rows.map((line) => JSON.parse(line));
  let elapsed = -1;
  for (const [index, frame] of frames.entries()) {
    assert.equal(frame.sampleIndex, index, 'native: последовательность кадров');
    assert.ok(
      Number.isFinite(frame.elapsedMs) && frame.elapsedMs >= 0 && frame.elapsedMs >= elapsed,
      'native: время кадра',
    );
    assert.match(frame.file, /^frames\/[A-Za-z0-9_-]+\.jpe?g$/, 'native: имя JPEG в индексе');
    elapsed = frame.elapsedMs;
  }
  return frames;
}

function validateInteractions(files, records, dimensions) {
  const result = records.get('result.json');
  assert.equal(result.spacePattern, 'interrupted', 'native: Space pattern');
  const captures = result.captures;
  assert.ok(
    result.gesturePattern === undefined || result.gesturePattern === 'cancel-drag',
    'native: gesture pattern',
  );
  const gestures =
    result.gesturePattern === 'cancel-drag'
      ? ['hover', 'pressed', 'rapid-space', 'cancel-drag', 'pointer-out']
      : ['hover', 'pressed', 'rapid-space', 'pointer-out'];
  assert.deepEqual(
    Object.keys(captures ?? {}).sort(),
    THEMES.toSorted(),
    'native: обе записи обязательны',
  );
  const required = [...staticFiles('interaction')];
  const identity = records.get('identity.json');
  const dynamic = identity.dynamicMotionExpected === true;
  if (dynamic) {
    assert.equal(
      result.dynamicMotion?.scenario,
      'dynamic-reduced-motion',
      'native: dynamic scenario missing',
    );
    required.push(...interactionNames('Dynamic'));
  } else assert.equal(result.dynamicMotion, undefined, 'native: dynamic scenario without opt-in');
  const origins = [];
  for (const theme of [...THEMES, ...(dynamic ? ['Dynamic'] : [])]) {
    const name = `interaction-${theme}`;
    const capture = theme === 'Dynamic' ? result.dynamicMotion : captures[theme];
    const manifest = records.get(`${name}.frames/manifest.json`);
    const record = records.get(`${name}-record.json`);
    const window = records.get(`${name}-window.json`);
    const frames = frameIndex(files.get(`${name}.frames/frames.ndjson`));
    const images = new Set(frames.map((frame) => `${name}.frames/${frame.file}`));
    required.push(...images);
    assert.equal(manifest.schemaVersion, 1, 'native: manifest version');
    assert.equal(manifest.status, 'complete', 'native: manifest incomplete');
    assert.equal(manifest.video.status, 'complete', 'native: video incomplete');
    assert.equal(manifest.frames.truncated, false, 'native: frames truncated');
    assert.equal(manifest.frames.index, 'frames.ndjson', 'native: index name');
    assert.equal(manifest.timing.sampleCount, frames.length, 'native: sample count');
    assert.equal(manifest.timing.imageCount, images.size, 'native: image count');
    assert.equal(manifest.video.fileSize, files.get(`${name}.mp4`).length, 'native: video size');
    assert.equal(record.mode, 'wgc', 'native: capture mode');
    assert.equal(record.frames, frames.length, 'native: recorded samples');
    assert.equal(record.fileSize, manifest.video.fileSize, 'native: recorded video size');
    assert.equal(capture.mode, 'wgc', 'native: summary mode');
    assert.equal(capture.samples, frames.length, 'native: summary samples');
    assert.equal(capture.images, images.size, 'native: summary images');
    assert.equal(capture.gestureTiming, `${name}-window.json`, 'native: timing filename');
    origins.push(
      theme === 'Dynamic'
        ? validateDynamicObservation(capture.space, identity, window, result.lifetime ? 10 : 9)
        : validateSpaceObservation(capture.space, identity, theme, window),
    );
    assert.equal(window.clock, 'harness-stopwatch-ms', 'native: timing clock');
    assert.deepEqual(
      window.gestures.map(({ name: gesture }) => gesture),
      theme === 'Dynamic' ? ['dynamic-space'] : gestures,
      'native: gestures',
    );
    if (theme !== 'Dynamic' && result.gesturePattern === 'cancel-drag') {
      assert.deepEqual(
        window.gestures[3].arguments,
        ['drag', 'LabButtonMedium', 'LabActionResult', '--hold-ms', '50'],
        'native: cancel-drag arguments',
      );
    }
    assert.ok(
      Number.isFinite(window.recordStartedMs) &&
        window.recordStartedMs >= 0 &&
        Number.isFinite(window.firstFrameReceivedMs) &&
        window.firstFrameReceivedMs > window.recordStartedMs,
      'native: первый кадр',
    );
    let completed = window.firstFrameReceivedMs;
    for (const gesture of window.gestures) {
      assert.ok(
        Number.isFinite(gesture.startedMs) &&
          gesture.startedMs >= completed &&
          Number.isFinite(gesture.completedMs) &&
          gesture.completedMs > gesture.startedMs &&
          gesture.completedMs - window.recordStartedMs < frames.at(-1).elapsedMs,
        'native: окно записи не покрывает ввод',
      );
      completed = gesture.completedMs;
    }
    for (const file of images) {
      const image = dimensions.get(file);
      assert.equal(image?.width, manifest.frames.width, 'native: JPEG width');
      assert.equal(image?.height, manifest.frames.height, 'native: JPEG height');
    }
  }
  assertSpaceClockOrigins(origins);
  return required;
}

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

function validate(files, sourceSha, mode) {
  source(sourceSha);
  modeCheck(mode);
  for (const file of staticFiles(mode)) assert.ok(files.has(file), 'native: набор файлов');
  let total = 0;
  const dimensions = new Map();
  const records = new Map();
  for (const [file, bytes] of files) {
    assert.ok(Buffer.isBuffer(bytes));
    assert.ok(bytes.length > 0 && bytes.length <= fileLimit(file, mode), 'native: размер файла');
    total += bytes.length;
    assert.ok(total <= MAX_TOTAL_BYTES, 'native: общий размер');
    if (file.endsWith('.png')) dimensions.set(file, png(bytes));
    else if (/\.jpe?g$/.test(file)) dimensions.set(file, jpeg(bytes));
    else if (file.endsWith('.mp4')) video(bytes);
    else if (!file.endsWith('.ndjson')) records.set(file, json(bytes));
  }
  const identity = records.get('identity.json');
  if (identity.dynamicMotionExpected !== undefined)
    assert.equal(typeof identity.dynamicMotionExpected, 'boolean', 'native: dynamic opt-in type');
  assert.equal(identity.source, sourceSha, 'native: identity source');
  for (const field of ['appSha256', 'consumerSha256', 'uiSha256', 'motionSha256', 'cliZipSha256']) {
    assert.match(identity[field], /^[a-f0-9]{64}$/i, `native: identity ${field}`);
  }
  assert.equal(records.get('result.json').passed, true, 'native: smoke не прошёл');
  const required =
    mode === 'interaction' ? validateInteractions(files, records, dimensions) : EVIDENCE_FILES;
  if (mode === 'idle') {
    assert.ok(
      identity.dynamicMotionExpected !== true &&
        records.get('result.json').dynamicMotion === undefined,
      'native: dynamic scenario requires interaction mode',
    );
    assert.equal(
      records.get('result.json').captures,
      undefined,
      'native: interaction mode required',
    );
  }
  assert.deepEqual([...files.keys()].sort(), [...required].sort(), 'native: набор файлов');
  const close = records.get('close.json');
  assert.equal(close.exited, true, 'native: приложение не завершилось');
  assert.equal(close.exitCode, 0, 'native: приложение завершилось с ошибкой');
  if (identity.dynamicMotionExpected === true) {
    assert.equal(
      typeof identity.animation.clientAreaBefore,
      'boolean',
      'native: исходная настройка',
    );
    assert.equal(
      close.animation?.expected,
      identity.animation.clientAreaBefore,
      'native: цель восстановления',
    );
    assert.equal(
      close.animation?.actual,
      identity.animation.clientAreaBefore,
      'native: настройка не восстановлена',
    );
    for (const field of ['applicationCleanupError', 'animationCleanupError'])
      assert.equal(close[field], undefined, 'native: dynamic cleanup failed');
  }
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

export function encodeNativeEvidence(files, sourceSha, mode = 'idle') {
  validate(files, sourceSha, mode);
  return [...files.keys()]
    .sort()
    .map((file) => evidenceLog(files.get(file), PREFIX, { file, sourceSha, mode }, 'sha256'))
    .join('');
}

export function decodeNativeEvidence(log, sourceSha, mode = 'idle') {
  source(sourceSha);
  modeCheck(mode);
  assert.ok(Buffer.byteLength(log, 'utf8') <= MAX_LOG_BYTES, 'native: журнал вне лимита');
  const files = new Map();
  for (const { metadata, bytes } of decodeEvidenceLog(log, PREFIX, {
    digestField: 'sha256',
    maxBytes: PNG_MAX_BYTES,
    maxPackets:
      mode === 'idle'
        ? EVIDENCE_FILES.length
        : staticFiles(mode).length + interactionNames('Dynamic').length + 3 * MAX_SAMPLES,
    maxTotalBytes: MAX_TOTAL_BYTES,
  })) {
    assert.equal(metadata.sourceSha, sourceSha, 'native: packet source');
    assert.ok(
      metadata.mode === mode || (mode === 'idle' && metadata.mode === undefined),
      'native: packet mode',
    );
    fileLimit(metadata.file, mode);
    assert.ok(!files.has(metadata.file), 'native: повторный файл');
    files.set(metadata.file, bytes);
  }
  return validate(files, sourceSha, mode);
}

async function boundedRead(path, maxBytes) {
  const stat = await lstat(path);
  assert.ok(stat.isFile() && stat.size <= maxBytes, 'native: не файл или превышен размер');
  const bytes = await readFile(path);
  assert.ok(bytes.length <= maxBytes, 'native: размер изменился при чтении');
  return bytes;
}

async function main(args) {
  const [operation, input, sourceSha] = args;
  const mode = args.at(-1);
  source(sourceSha);
  modeCheck(mode);
  if (operation === 'export' && args.length === 4) {
    const files = new Map();
    let total = 0;
    const load = async (file) => {
      const path = join(resolve(input), file);
      const limit = fileLimit(file, mode);
      const stat = await lstat(path);
      assert.ok(
        stat.isFile() && stat.size > 0 && stat.size <= limit,
        'native: не файл или превышен размер',
      );
      assert.ok(total + stat.size <= MAX_TOTAL_BYTES, 'native: общий размер');
      const bytes = await boundedRead(path, Math.min(limit, MAX_TOTAL_BYTES - total));
      files.set(file, bytes);
      total += bytes.length;
    };
    for (const file of staticFiles(mode)) await load(file);
    if (mode === 'interaction') {
      const dynamic = json(files.get('identity.json')).dynamicMotionExpected === true;
      if (dynamic) for (const file of interactionNames('Dynamic')) await load(file);
      for (const theme of [...THEMES, ...(dynamic ? ['Dynamic'] : [])]) {
        const name = `interaction-${theme}.frames`;
        for (const directory of [name, `${name}/frames`]) {
          assert.ok(
            (await lstat(join(resolve(input), directory))).isDirectory(),
            'native: каталог кадров',
          );
        }
        const names = new Set(
          frameIndex(files.get(`${name}/frames.ndjson`)).map(({ file }) => `${name}/${file}`),
        );
        for (const file of names) await load(file);
      }
    }
    await writeStdout(encodeNativeEvidence(files, sourceSha, mode));
  } else if (operation === 'decode' && args.length === 5) {
    const log = new TextDecoder('utf-8', { fatal: true }).decode(
      await boundedRead(resolve(input), MAX_LOG_BYTES),
    );
    const files = decodeNativeEvidence(log, sourceSha, mode);
    const target = resolve(args[3]);
    await mkdir(target);
    for (const [file, bytes] of files) {
      await mkdir(dirname(join(target, file)), { recursive: true });
      await writeFile(join(target, file), bytes, { flag: 'wx' });
    }
    const manifest = {
      schemaVersion: 1,
      sourceSha,
      mode,
      coverage:
        mode === 'interaction' ? 'all indexed JPEG frames and complete MP4' : 'idle screenshots',
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
      'Usage: evidence.mjs export <directory> <source-sha> <idle|interaction> | decode <job.log> <source-sha> <new-directory> <idle|interaction>',
    );
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
