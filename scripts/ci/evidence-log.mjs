import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

// Общий wire сохраняет формат уже опубликованных Icons-журналов.
export function evidenceLog(bytes, prefix, identity, digestField) {
  const compressed = gzipSync(bytes, { level: 9 });
  const chunks = compressed.toString('base64').match(/.{1,4096}/g);
  const digest = hash(bytes);
  const metadata = {
    schemaVersion: 1,
    encoding: 'gzip-base64',
    ...identity,
    [digestField]: digest,
    bytes: bytes.length,
    compressedBytes: compressed.length,
    chunks: chunks.length,
  };
  const lines = [
    `${prefix}_BEGIN ${JSON.stringify(metadata)}`,
    ...chunks.map((chunk, index) => `${prefix}_CHUNK ${index} ${chunk}`),
    `${prefix}_END ${digest}`,
  ].join('\n');
  return `${lines}\n`;
}

export function writeStdout(bytes) {
  const output = process.stdout;
  return new Promise((resolve, reject) => {
    output.once('error', reject);
    try {
      output.write(bytes, (error) => {
        if (error) {
          // Writable вызывает callback до события error; once-обработчик остаётся
          // до него, чтобы ошибка потока не затёрла исходную причину.
          reject(error);
          return;
        }
        output.removeListener('error', reject);
        resolve();
      });
    } catch (error) {
      output.removeListener('error', reject);
      reject(error);
    }
  });
}

// Первый REST timestamp отделяет payload: его tab-диагностика не становится gh columns.
const TIMESTAMP_PREFIX = String.raw`\uFEFF?\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z[ \t]+`;
const LOG_PREFIX = new RegExp(
  String.raw`^(?:${TIMESTAMP_PREFIX}|[^\t\r\n]+\t[^\t\r\n]+\t${TIMESTAMP_PREFIX})`,
);
const positive = (value) => Number.isSafeInteger(value) && value > 0;

export function decodeEvidenceLog(
  log,
  prefix,
  { digestField, maxBytes, maxPackets, maxTotalBytes = maxBytes * maxPackets },
) {
  assert.match(prefix, /^[A-Z][A-Z0-9_]*$/);
  assert.match(digestField, /^[A-Za-z][A-Za-z0-9]*$/);
  assert.ok(positive(maxBytes) && positive(maxPackets) && positive(maxTotalBytes));
  assert.equal(typeof log, 'string');
  const packets = [];
  let current;
  let totalBytes = 0;
  for (const raw of log.split(/\r?\n/)) {
    const line = raw.replace(LOG_PREFIX, '');
    if (!line.startsWith(`${prefix}_`)) continue;
    if (line.startsWith(`${prefix}_BEGIN `)) {
      assert.equal(current, undefined, 'evidence: вложенный BEGIN');
      assert.ok(packets.length < maxPackets, 'evidence: слишком много пакетов');
      const metadata = JSON.parse(line.slice(`${prefix}_BEGIN `.length));
      assert.equal(metadata.schemaVersion, 1, 'evidence: schemaVersion');
      assert.equal(metadata.encoding, 'gzip-base64', 'evidence: encoding');
      assert.match(metadata[digestField], /^[a-f0-9]{64}$/);
      assert.ok(
        Number.isSafeInteger(metadata.bytes) && metadata.bytes >= 0 && metadata.bytes <= maxBytes,
        'evidence: bytes вне лимита',
      );
      assert.ok(
        positive(metadata.compressedBytes) && metadata.compressedBytes <= maxBytes * 2 + 1024,
        'evidence: compressedBytes вне лимита',
      );
      assert.equal(
        metadata.chunks,
        Math.ceil((4 * Math.ceil(metadata.compressedBytes / 3)) / 4096),
        'evidence: число chunks',
      );
      totalBytes += metadata.bytes;
      assert.ok(totalBytes <= maxTotalBytes, 'evidence: общий размер вне лимита');
      current = { metadata, chunks: [] };
    } else if (line.startsWith(`${prefix}_CHUNK `)) {
      assert.ok(current, 'evidence: CHUNK без BEGIN');
      const fields = line.slice(`${prefix}_CHUNK `.length).split(' ');
      assert.equal(fields.length, 2, 'evidence: поля CHUNK');
      assert.equal(fields[0], String(current.chunks.length), 'evidence: порядок CHUNK');
      assert.ok(current.chunks.length < current.metadata.chunks, 'evidence: лишний CHUNK');
      assert.match(fields[1], /^[A-Za-z0-9+/=]{1,4096}$/);
      if (current.chunks.length < current.metadata.chunks - 1) {
        assert.equal(fields[1].length, 4096, 'evidence: неполный промежуточный CHUNK');
      }
      current.chunks.push(fields[1]);
    } else if (line.startsWith(`${prefix}_END `)) {
      assert.ok(current, 'evidence: END без BEGIN');
      const { metadata, chunks } = current;
      assert.equal(line, `${prefix}_END ${metadata[digestField]}`, 'evidence: END digest');
      assert.equal(chunks.length, metadata.chunks, 'evidence: потерян CHUNK');
      const base64 = chunks.join('');
      const compressed = Buffer.from(base64, 'base64');
      assert.equal(compressed.toString('base64'), base64, 'evidence: неканонический base64');
      assert.equal(compressed.length, metadata.compressedBytes, 'evidence: compressedBytes');
      const bytes = gunzipSync(compressed, { maxOutputLength: Math.max(1, metadata.bytes) });
      assert.equal(bytes.length, metadata.bytes, 'evidence: bytes');
      assert.equal(hash(bytes), metadata[digestField], 'evidence: SHA256');
      packets.push({ metadata, bytes });
      current = undefined;
    } else {
      assert.fail('evidence: неизвестный маркер');
    }
  }
  assert.equal(current, undefined, 'evidence: потерян END');
  return packets;
}
