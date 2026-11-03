import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { gunzipSync, gzipSync } from 'node:zlib';
import { decodeEvidenceLog, evidenceLog } from './evidence-log.mjs';

const prefix = 'TEST_EVIDENCE';
const limits = { digestField: 'sha256', maxBytes: 32768, maxPackets: 3 };
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const payload = Buffer.concat(
  Array.from({ length: 512 }, (_, i) => createHash('sha256').update(String(i)).digest()),
);
const packet = evidenceLog(payload, prefix, { sourceSha: 'a'.repeat(40) }, 'sha256');

test('legacy wire preserves field order, exact bytes and gzip chunks', () => {
  const lines = packet.trimEnd().split('\n');
  const metadata = JSON.parse(lines[0].slice(`${prefix}_BEGIN `.length));
  assert.deepEqual(Object.keys(metadata), [
    'schemaVersion',
    'encoding',
    'sourceSha',
    'sha256',
    'bytes',
    'compressedBytes',
    'chunks',
  ]);
  const compressed = gzipSync(payload, { level: 9 });
  assert.equal(metadata.compressedBytes, compressed.length);
  assert.equal(metadata.bytes, payload.length);
  assert.equal(metadata.sha256, hash(payload));
  const chunks = lines.slice(1, -1).map((line, i) => {
    const [marker, index, bytes] = line.split(' ');
    assert.equal(marker, `${prefix}_CHUNK`);
    assert.equal(index, String(i));
    assert.ok(bytes.length <= 4096);
    return bytes;
  });
  assert.ok(chunks.length > 1);
  assert.equal(chunks.length, metadata.chunks);
  assert.deepEqual(Buffer.from(chunks.join(''), 'base64'), compressed);
  assert.deepEqual(gunzipSync(compressed), payload);
  assert.equal(lines.at(-1), `${prefix}_END ${hash(payload)}`);
});

test('readback handles raw, REST timestamp and gh tab-column logs without taking embedded text', () => {
  for (const wrapper of [
    '',
    '2026-11-03T05:50:07.9850450Z ',
    'Windows Button\tExport\t2026-11-03T05:50:07.9850450Z ',
  ]) {
    const log = `diagnostic ${prefix}_BEGIN ignored\n${packet
      .trimEnd()
      .split('\n')
      .map((line) => wrapper + line)
      .join('\r\n')}\n`;
    const packets = decodeEvidenceLog(log, prefix, limits);
    assert.equal(packets.length, 1);
    assert.deepEqual(packets[0].bytes, payload);
  }
  assert.equal(decodeEvidenceLog(`${packet}${packet}`, prefix, limits).length, 2);
});

test('timestamped readback preserves a packet across a BOM log-block boundary', async (t) => {
  const lines = packet.trimEnd().split('\n');
  const timestamp = '2026-11-03T08:13:58.9443536Z ';
  const wrap = (boundaryPrefix, columns = '') =>
    lines
      .map((line, index) => (index === 2 ? boundaryPrefix : columns + timestamp) + line)
      .join('\r\n');

  await t.test('REST and gh logs preserve bytes when a later chunk starts a new block', () => {
    for (const columns of ['', 'Windows Button\tExport\t']) {
      const log = wrap(`${columns}\uFEFF${timestamp}`, columns);
      const packets = decodeEvidenceLog(log, prefix, limits);
      assert.equal(packets.length, 1);
      assert.deepEqual(packets[0].bytes, payload);
    }
  });

  await t.test('diagnostics and misplaced BOMs cannot supply a missing chunk', () => {
    for (const boundaryPrefix of [
      `diagnostic \uFEFF${timestamp}`,
      '\uFEFF',
      `${timestamp}\uFEFF`,
      ` \uFEFF${timestamp}`,
      `\uFEFF\uFEFF${timestamp}`,
      '\uFEFF2026-11-03 08:13:58.9443536Z ',
      `Windows Button\tExport\t${timestamp}\uFEFF`,
    ]) {
      assert.throws(() => decodeEvidenceLog(wrap(boundaryPrefix), prefix, limits));
    }
  });

  await t.test('BOM handling preserves chunk-order and payload-digest checks', () => {
    const log = wrap(`\uFEFF${timestamp}`);
    assert.throws(() =>
      decodeEvidenceLog(log.replace(`${prefix}_CHUNK 1 `, `${prefix}_CHUNK 0 `), prefix, limits),
    );
    assert.throws(() =>
      decodeEvidenceLog(log.replaceAll(hash(payload), '0'.repeat(64)), prefix, limits),
    );
  });
});

test('a REST timestamp keeps tabbed diagnostics from becoming gh evidence columns', () => {
  const timestamp = '2026-11-03T08:13:58.9443536Z ';
  for (const bom of ['', '\uFEFF']) {
    const embedded = packet
      .trimEnd()
      .split('\n')
      .map((line) => `${timestamp}diagnostic text\tfake column\t${bom}${timestamp}${line}`)
      .join('\n');
    assert.equal(decodeEvidenceLog(embedded, prefix, limits).length, 0);
    const lines = packet.trimEnd().split('\n');
    lines[2] = `${timestamp}diagnostic text\tfake column\t${bom}${timestamp}${lines[2]}`;
    assert.throws(() => decodeEvidenceLog(lines.join('\n'), prefix, limits));
  }
});

test('framing rejects truncation, duplication, reordering, interleaving and trailing markers', () => {
  const lines = packet.trimEnd().split('\n');
  const mutations = [
    lines.slice(0, -1).join('\n'),
    [lines[0], lines[1], ...lines.slice(1)].join('\n'),
    [lines[0], lines[2], lines[1], ...lines.slice(3)].join('\n'),
    [lines[0], lines[0], ...lines.slice(1)].join('\n'),
    lines.slice(1).join('\n'),
    `${packet}${lines.at(-1)}\n`,
    `${packet}${prefix}_UNKNOWN\n`,
    packet.replace(`${prefix}_CHUNK 0 `, `${prefix}_CHUNK 00 `),
    packet.replace(`${prefix}_CHUNK 0 `, `${prefix}_CHUNK 0  `),
    lines.filter((_, i) => i !== 1).join('\n'),
  ];
  for (const log of mutations) assert.throws(() => decodeEvidenceLog(log, prefix, limits));
});

test('limits and digests reject hostile metadata or payload before accepting bytes', () => {
  const lines = packet.trimEnd().split('\n');
  const original = JSON.parse(lines[0].slice(`${prefix}_BEGIN `.length));
  for (const delta of [
    { schemaVersion: 2 },
    { encoding: 'base64' },
    { bytes: limits.maxBytes + 1 },
    { bytes: 1 },
    { bytes: -1 },
    { bytes: 0.5 },
    { compressedBytes: 1e9 },
    { compressedBytes: original.compressedBytes - 1 },
    { chunks: original.chunks + 1 },
    { sha256: 'b'.repeat(64) },
  ]) {
    const log = [
      `${prefix}_BEGIN ${JSON.stringify({ ...original, ...delta })}`,
      ...lines.slice(1),
    ].join('\n');
    assert.throws(() => decodeEvidenceLog(log, prefix, limits));
  }
  assert.throws(() =>
    decodeEvidenceLog(packet.replace(/_END [a-f0-9]+/, `_END ${'0'.repeat(64)}`), prefix, limits),
  );
  const damaged = [...lines];
  damaged[1] = damaged[1].slice(0, -1) + (damaged[1].endsWith('A') ? 'B' : 'A');
  assert.throws(() => decodeEvidenceLog(damaged.join('\n'), prefix, limits));
  assert.throws(() =>
    decodeEvidenceLog(`${packet}${packet}`, prefix, { ...limits, maxPackets: 1 }),
  );
  assert.throws(() =>
    decodeEvidenceLog(`${packet}${packet}`, prefix, { ...limits, maxTotalBytes: payload.length }),
  );
});

test('awaited stdout observes completion and propagates callback, event and synchronous errors', () => {
  const url = new URL('./evidence-log.mjs', import.meta.url).href;
  const script = `
    import assert from 'node:assert/strict';
    import { writeStdout } from ${JSON.stringify(url)};
    const output = process.stdout;
    const before = output.listenerCount('error');
    let completed = false;
    output.write = (_, callback) => { setTimeout(() => { completed = true; callback(); }, 10); return false; };
    const pending = writeStdout('payload');
    assert.equal(completed, false);
    await pending;
    assert.equal(completed, true);
    assert.equal(output.listenerCount('error'), before);
    output.write = (_, callback) => { queueMicrotask(() => { const error = new Error('callback failure'); callback(error); output.emit('error', error); }); };
    await assert.rejects(writeStdout('payload'), /callback failure/);
    assert.equal(output.listenerCount('error'), before);
    output.write = () => { queueMicrotask(() => output.emit('error', new Error('event failure'))); };
    await assert.rejects(writeStdout('payload'), /event failure/);
    assert.equal(output.listenerCount('error'), before);
    output.write = () => { throw new Error('sync failure'); };
    await assert.rejects(writeStdout('payload'), /sync failure/);
    assert.equal(output.listenerCount('error'), before);
  `;
  execFileSync(process.execPath, ['--input-type=module', '-e', script], { timeout: 10000 });
});
