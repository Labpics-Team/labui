import { crc32, inflateSync } from 'node:zlib';

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const maximumBytes = 4 * 1024 * 1024;
const maximumPixels = 16 * 1024 * 1024;

function requireProfile(condition) {
  if (!condition)
    throw Object.assign(new Error('PNG вне публичного профиля screenshot'), {
      code: 'PUBLIC_EVIDENCE_REFUSED',
    });
}

// Профиль native screenshot не допускает произвольные, в том числе сжатые,
// metadata. Распаковка ограничена размером canvas; pixels не пересэмплируются.
export function assertPublicScreenshot(bytes) {
  requireProfile(Buffer.isBuffer(bytes) && bytes.length >= 45 && bytes.length <= maximumBytes);
  requireProfile(bytes.subarray(0, 8).equals(signature));
  let offset = 8;
  let dimensions;
  let imageData = false;
  let ended = false;
  let channels;
  const compressedParts = [];
  while (offset < bytes.length) {
    requireProfile(bytes.length - offset >= 12 && !ended);
    const length = bytes.readUInt32BE(offset);
    requireProfile(length <= bytes.length - offset - 12);
    const type = bytes.toString('latin1', offset + 4, offset + 8);
    const payload = bytes.subarray(offset + 8, offset + 8 + length);
    const expectedCrc = bytes.readUInt32BE(offset + 8 + length);
    requireProfile(crc32(bytes.subarray(offset + 4, offset + 8 + length)) === expectedCrc);
    if (type === 'IHDR') {
      requireProfile(offset === 8 && length === 13);
      const width = payload.readUInt32BE(0);
      const height = payload.readUInt32BE(4);
      requireProfile(width > 0 && height > 0 && width * height <= maximumPixels);
      requireProfile(payload[8] === 8 && [0, 2, 4, 6].includes(payload[9]));
      requireProfile(payload[10] === 0 && payload[11] === 0 && payload[12] === 0);
      channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[payload[9]];
      dimensions = { width, height };
    } else if (type === 'IDAT') {
      requireProfile(dimensions !== undefined);
      compressedParts.push(payload);
      imageData = true;
    } else if (type === 'IEND') {
      requireProfile(length === 0 && imageData);
      ended = true;
    } else {
      requireProfile(false);
    }
    offset += length + 12;
  }
  requireProfile(ended && offset === bytes.length);
  const stride = dimensions.width * channels + 1;
  const expectedBytes = stride * dimensions.height;
  const compressed = Buffer.concat(compressedParts);
  let decoded;
  try {
    decoded = inflateSync(compressed, { info: true, maxOutputLength: expectedBytes });
  } catch {
    requireProfile(false);
  }
  requireProfile(decoded.engine.bytesWritten === compressed.length);
  requireProfile(decoded.buffer.length === expectedBytes);
  for (let row = 0; row < dimensions.height; row++)
    requireProfile(decoded.buffer[row * stride] <= 4);
  return dimensions;
}
