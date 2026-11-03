import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
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
// Реальный однопиксельный JPEG; MP4 boxes ниже проверяют транспорт, не воспроизведение.
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9U6KKKAP/2Q==',
  'base64',
);
const box = (type) => {
  const bytes = Buffer.alloc(12);
  bytes.writeUInt32BE(bytes.length);
  bytes.write(type, 4, 'ascii');
  return bytes;
};
const MP4 = Buffer.concat(['ftyp', 'moov', 'mdat'].map(box));

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

const interactionPackets = (files) =>
  [...files]
    .map(([file, bytes]) =>
      evidenceLog(bytes, PREFIX, { file, sourceSha: SOURCE, mode: 'interaction' }, 'sha256'),
    )
    .join('');

function interactionFixture() {
  const files = fixture();
  const captures = {};
  for (const theme of ['Light', 'Dark']) {
    const name = `interaction-${theme}`;
    const frames = Array.from({ length: 10 }, (_, sampleIndex) => ({
      sampleIndex,
      elapsedMs: sampleIndex * 100,
      file: 'frames/frame-000000.jpg',
    }));
    files.set(`${name}-hover.png`, PNG);
    files.set(`${name}.mp4`, MP4);
    files.set(`${name}-record.json`, json({ mode: 'wgc', frames: 10, fileSize: MP4.length }));
    files.set(
      `${name}-window.json`,
      json({
        clock: 'harness-stopwatch-ms',
        recordStartedMs: 1,
        firstFrameReceivedMs: 5,
        gestures: ['hover', 'pressed', 'rapid-space', 'pointer-out'].map((name, index) => ({
          name,
          startedMs: 10 + index * 100,
          completedMs: 20 + index * 100,
        })),
      }),
    );
    files.set(
      `${name}.frames/manifest.json`,
      json({
        schemaVersion: 1,
        status: 'complete',
        timing: { sampleCount: 10, imageCount: 1 },
        video: { status: 'complete', fileSize: MP4.length },
        frames: { truncated: false, index: 'frames.ndjson', width: 1, height: 1 },
      }),
    );
    files.set(
      `${name}.frames/frames.ndjson`,
      Buffer.from(`${frames.map(JSON.stringify).join('\n')}\n`),
    );
    files.set(`${name}.frames/frames/frame-000000.jpg`, JPEG);
    captures[theme] = { mode: 'wgc', samples: 10, images: 1, gestureTiming: `${name}-window.json` };
  }
  files.set('result.json', json({ passed: true, captures, smoothness: 'not-qualified' }));
  return files;
}

function editJSON(files, file, change) {
  const value = JSON.parse(files.get(file));
  change(value);
  files.set(file, json(value));
}

function cancelDragFixture() {
  const files = interactionFixture();
  editJSON(files, 'result.json', (value) => {
    value.gesturePattern = 'cancel-drag';
  });
  for (const theme of ['Light', 'Dark']) {
    editJSON(files, `interaction-${theme}-window.json`, (value) => {
      value.gestures.splice(3, 0, {
        name: 'cancel-drag',
        arguments: ['drag', 'LabButtonMedium', 'LabActionResult', '--hold-ms', '50'],
        startedMs: 310,
        completedMs: 320,
      });
      value.gestures[4].startedMs = 410;
      value.gestures[4].completedMs = 420;
    });
  }
  return files;
}

test('cancel-drag and legacy captures retain every byte under their explicit gesture contract', () => {
  for (const files of [interactionFixture(), cancelDragFixture()]) {
    assert.deepEqual(
      decodeNativeEvidence(
        encodeNativeEvidence(files, SOURCE, 'interaction'),
        SOURCE,
        'interaction',
      ),
      files,
    );
    assert.deepEqual(decodeNativeEvidence(interactionPackets(files), SOURCE, 'interaction'), files);
  }
});

test('cancel-drag cannot be missing, reordered, mixed with legacy or silently downgraded', () => {
  const rejects = (files, reason = 'invalid cancel-drag contract') => {
    assert.throws(() => encodeNativeEvidence(files, SOURCE, 'interaction'), reason);
    assert.throws(
      () => decodeNativeEvidence(interactionPackets(files), SOURCE, 'interaction'),
      reason,
    );
  };
  const declaredButAbsent = interactionFixture();
  editJSON(declaredButAbsent, 'result.json', (value) => {
    value.gesturePattern = 'cancel-drag';
  });
  rejects(declaredButAbsent, 'declared current pattern cannot omit cancel-drag');
  for (const pattern of [null, '', 'future', 'CANCEL-DRAG', false, 1]) {
    const files = interactionFixture();
    editJSON(files, 'result.json', (value) => {
      value.gesturePattern = pattern;
    });
    rejects(files);
  }
  const unmarked = cancelDragFixture();
  editJSON(unmarked, 'result.json', (value) => {
    value.gesturePattern = undefined;
  });
  rejects(unmarked);
  for (const theme of ['Light', 'Dark']) {
    const file = `interaction-${theme}-window.json`;
    for (let index = 0; index < 5; index++) {
      const missing = cancelDragFixture();
      editJSON(missing, file, (value) => value.gestures.splice(index, 1));
      rejects(missing);
      if (index < 4) {
        const swapped = cancelDragFixture();
        editJSON(swapped, file, (value) => {
          const names = value.gestures.map((gesture) => gesture.name);
          value.gestures[index].name = names[index + 1];
          value.gestures[index + 1].name = names[index];
        });
        rejects(swapped);
      }
    }
    const extra = cancelDragFixture();
    editJSON(extra, file, (value) => value.gestures.push({ ...value.gestures[4] }));
    rejects(extra);
  }
});

test('cancel-drag validates its command and complete monotonic capture window on both boundaries', () => {
  const argumentsToReject = [
    undefined,
    [],
    ['drag', 'LabButtonMedium', 'LabButtonMedium', '--hold-ms', '50'],
    ['drag', 'LabActionResult', 'LabButtonMedium', '--hold-ms', '50'],
    ['drag', 'LabButtonMedium', 'LabActionResult', '--hold-ms', '1000'],
    ['drag', 'LabButtonMedium', 'LabActionResult', '--hold-ms', 50],
    ['drag', 'LabButtonMedium', 'LabActionResult', '--hold-ms', '50', '--other'],
  ];
  for (const theme of ['Light', 'Dark']) {
    for (const mutate of [
      ...argumentsToReject.map((args) => (value) => {
        value.gestures[3].arguments = args;
      }),
      (value) => {
        value.gestures[3].startedMs = 219;
      },
      (value) => {
        value.gestures[3].completedMs = value.gestures[3].startedMs;
      },
      (value) => {
        value.gestures[3].completedMs = 411;
      },
      (value) => {
        value.gestures[4].completedMs = 901;
      },
      (value) => {
        value.gestures[3].startedMs = null;
      },
      (value) => {
        value.firstFrameReceivedMs = 11;
      },
    ]) {
      const files = cancelDragFixture();
      editJSON(files, `interaction-${theme}-window.json`, mutate);
      assert.throws(() => encodeNativeEvidence(files, SOURCE, 'interaction'));
      assert.throws(() => decodeNativeEvidence(interactionPackets(files), SOURCE, 'interaction'));
    }
  }
});

test('interaction mode preserves both full clips and every indexed JPEG without an idle downgrade', () => {
  const files = interactionFixture();
  const log = encodeNativeEvidence(files, SOURCE, 'interaction');
  assert.equal(files.size, 28);
  assert.deepEqual(decodeNativeEvidence(log, SOURCE, 'interaction'), files);
  assert.throws(() => encodeNativeEvidence(files, SOURCE, 'idle'));
  assert.throws(() => decodeNativeEvidence(log, SOURCE, 'idle'));
  assert.throws(() => encodeNativeEvidence(files, SOURCE, 'guess'), /mode/);
  assert.throws(() => decodeNativeEvidence(log, SOURCE, 'guess'), /mode/);
  const stripped = new Map([...files].filter(([file]) => EVIDENCE_FILES.includes(file)));
  assert.throws(() => encodeNativeEvidence(stripped, SOURCE, 'idle'), /interaction mode/);
});

test('interaction delivery rejects omission of every required static file or unique image', () => {
  const original = interactionFixture();
  for (const file of original.keys()) {
    const files = new Map(original);
    files.delete(file);
    assert.throws(() => encodeNativeEvidence(files, SOURCE, 'interaction'), file);
    assert.throws(
      () => decodeNativeEvidence(interactionPackets(files), SOURCE, 'interaction'),
      file,
    );
  }
  const files = interactionFixture();
  files.set('interaction-Light.frames/frames/unreferenced.jpg', JPEG);
  assert.throws(() => encodeNativeEvidence(files, SOURCE, 'interaction'), /набор файлов/);
  assert.throws(
    () => decodeNativeEvidence(interactionPackets(files), SOURCE, 'interaction'),
    /набор файлов/,
  );
});

test('idle cannot drop declared interaction evidence', () => {
  const stripped = new Map(
    [...interactionFixture()].filter(([file]) => EVIDENCE_FILES.includes(file)),
  );
  assert.throws(() => encodeNativeEvidence(stripped, SOURCE, 'idle'), /interaction mode/);
  assert.throws(
    () => decodeNativeEvidence(rawPackets(stripped), SOURCE, 'idle'),
    /interaction mode/,
  );
});

test('partial manifests, wrong counts and unsafe frame indices cannot look like complete capture', () => {
  const mutations = [
    (files) =>
      editJSON(files, 'result.json', (value) => {
        value.captures.Dark = undefined;
      }),
    (files) =>
      editJSON(files, 'interaction-Light.frames/manifest.json', (value) => {
        value.status = 'partial';
      }),
    (files) =>
      editJSON(files, 'interaction-Light.frames/manifest.json', (value) => {
        value.frames.truncated = true;
      }),
    (files) =>
      editJSON(files, 'interaction-Light.frames/manifest.json', (value) => {
        value.timing.sampleCount++;
      }),
    (files) =>
      editJSON(files, 'interaction-Light.frames/manifest.json', (value) => {
        value.timing.imageCount++;
      }),
    (files) =>
      editJSON(files, 'interaction-Light.frames/manifest.json', (value) => {
        value.video.fileSize++;
      }),
    (files) =>
      editJSON(files, 'interaction-Light.frames/manifest.json', (value) => {
        value.frames.width++;
      }),
    (files) =>
      editJSON(files, 'interaction-Light-record.json', (value) => {
        value.frames++;
      }),
    (files) =>
      editJSON(files, 'interaction-Light-window.json', (value) => {
        value.gestures.pop();
      }),
    (files) =>
      editJSON(files, 'interaction-Light-window.json', (value) => {
        value.gestures[0].startedMs = null;
      }),
    (files) =>
      editJSON(files, 'interaction-Light-window.json', (value) => {
        value.gestures[3].completedMs = 901;
      }),
    (files) => files.set('interaction-Light.mp4', MP4.subarray(0, -1)),
    (files) => files.set('interaction-Light.frames/frames/frame-000000.jpg', JPEG.subarray(0, -2)),
    ...[
      '../private.jpg',
      'frames/../private.jpg',
      'frames\\frame-000000.jpg',
      'frames/private.png',
    ].map(
      (file) => (files) =>
        files.set(
          'interaction-Light.frames/frames.ndjson',
          Buffer.from(
            Array.from({ length: 10 }, (_, sampleIndex) =>
              JSON.stringify({ sampleIndex, elapsedMs: sampleIndex, file }),
            ).join('\n'),
          ),
        ),
    ),
    (files) =>
      files.set(
        'interaction-Light.frames/frames.ndjson',
        Buffer.from(
          Array.from({ length: 10 }, () =>
            JSON.stringify({ sampleIndex: 0, elapsedMs: 0, file: 'frames/frame-000000.jpg' }),
          ).join('\n'),
        ),
      ),
  ];
  for (const mutate of mutations) {
    const files = interactionFixture();
    mutate(files);
    assert.throws(() => encodeNativeEvidence(files, SOURCE, 'interaction'));
    assert.throws(() => decodeNativeEvidence(interactionPackets(files), SOURCE, 'interaction'));
  }
  const files = interactionFixture();
  assert.deepEqual(decodeNativeEvidence(interactionPackets(files), SOURCE, 'interaction'), files);
});

test('media and index budgets reject oversized data before accepting a bundle', () => {
  for (const [file, limit] of [
    ['interaction-Light.mp4', 4 * 1024 * 1024],
    ['interaction-Light.frames/frames.ndjson', 1024 * 1024],
    ['interaction-Light.frames/frames/frame-000000.jpg', 1024 * 1024],
  ]) {
    const files = interactionFixture();
    files.set(file, Buffer.alloc(limit + 1));
    assert.throws(() => encodeNativeEvidence(files, SOURCE, 'interaction'), /размер/);
    assert.throws(() => decodeNativeEvidence(interactionPackets(files), SOURCE, 'interaction'));
  }
});

test('total budget counts all unique images before emitting a packet', () => {
  const comment = Buffer.alloc(65002);
  comment.writeUInt16BE(0xfffe);
  comment.writeUInt16BE(65000, 2);
  const padded = Buffer.concat([JPEG.subarray(0, 2), ...Array(14).fill(comment), JPEG.subarray(2)]);
  const make = (count) => {
    const files = interactionFixture();
    const name = 'interaction-Light';
    files.delete(`${name}.frames/frames/frame-000000.jpg`);
    const frames = Array.from({ length: count }, (_, sampleIndex) => {
      const file = `frames/large-${sampleIndex}.jpg`;
      files.set(`${name}.frames/${file}`, padded);
      return { sampleIndex, elapsedMs: sampleIndex * 100, file };
    });
    files.set(`${name}.frames/frames.ndjson`, Buffer.from(frames.map(JSON.stringify).join('\n')));
    editJSON(files, `${name}.frames/manifest.json`, (value) => {
      value.timing = { sampleCount: count, imageCount: count };
    });
    editJSON(files, `${name}-record.json`, (value) => {
      value.frames = count;
    });
    editJSON(files, 'result.json', (value) => {
      value.captures.Light.samples = count;
      value.captures.Light.images = count;
    });
    return files;
  };
  const tooLarge = make(20);
  assert.throws(() => encodeNativeEvidence(tooLarge, SOURCE, 'interaction'), /общий размер/);
  assert.throws(
    () => decodeNativeEvidence(interactionPackets(tooLarge), SOURCE, 'interaction'),
    /общий размер/,
  );
  const withinBudget = make(18);
  assert.deepEqual(
    decodeNativeEvidence(
      encodeNativeEvidence(withinBudget, SOURCE, 'interaction'),
      SOURCE,
      'interaction',
    ),
    withinBudget,
  );
});

test('interaction CLI emits nothing for a missing late image and recreates nested full evidence', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'labui-native-interaction-evidence-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const files = interactionFixture();
  for (const [file, bytes] of files) {
    await mkdir(dirname(join(directory, file)), { recursive: true });
    await writeFile(join(directory, file), bytes);
  }
  const exported = spawnSync(process.execPath, [CLI, 'export', directory, SOURCE, 'interaction'], {
    encoding: 'utf8',
  });
  assert.equal(exported.status, 0, exported.stderr);
  const input = join(directory, 'job.log');
  const output = join(directory, 'readback');
  await writeFile(input, exported.stdout);
  const decoded = spawnSync(
    process.execPath,
    [CLI, 'decode', input, SOURCE, output, 'interaction'],
    { encoding: 'utf8' },
  );
  assert.equal(decoded.status, 0, decoded.stderr);
  for (const [file, bytes] of files) assert.deepEqual(await readFile(join(output, file)), bytes);
  const manifest = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'));
  assert.equal(manifest.mode, 'interaction');
  assert.equal(manifest.coverage, 'all indexed JPEG frames and complete MP4');
  await rm(join(directory, 'interaction-Dark.frames/frames/frame-000000.jpg'));
  const failed = spawnSync(process.execPath, [CLI, 'export', directory, SOURCE, 'interaction'], {
    encoding: 'utf8',
  });
  assert.notEqual(failed.status, 0);
  assert.equal(failed.stdout, '');
  const implicit = spawnSync(process.execPath, [CLI, 'export', directory, SOURCE], {
    encoding: 'utf8',
  });
  assert.notEqual(implicit.status, 0);
  assert.equal(implicit.stdout, '');
});

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
  const exported = spawnSync(process.execPath, [CLI, 'export', directory, SOURCE, 'idle'], {
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
  const decoded = spawnSync(process.execPath, [CLI, 'decode', input, SOURCE, output, 'idle'], {
    encoding: 'utf8',
  });
  assert.equal(decoded.status, 0, decoded.stderr);
  for (const [file, bytes] of files) assert.deepEqual(await readFile(join(output, file)), bytes);
  const manifest = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'));
  assert.equal(manifest.sourceSha, SOURCE);
  assert.equal(manifest.files.length, 14);
  const again = spawnSync(process.execPath, [CLI, 'decode', input, SOURCE, output, 'idle'], {
    encoding: 'utf8',
  });
  assert.notEqual(again.status, 0, 'readback must not overwrite prior evidence');
  await rm(join(directory, 'focus.png'));
  const incomplete = spawnSync(process.execPath, [CLI, 'export', directory, SOURCE, 'idle'], {
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
    assert.match(step, /\$source interaction/);
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
