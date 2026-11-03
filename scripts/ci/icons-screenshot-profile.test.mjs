import assert from 'node:assert/strict';
import test from 'node:test';
import { crc32, deflateSync, inflateSync } from 'node:zlib';
import { assertPublicScreenshot } from './icons-screenshot-profile.mjs';

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const refused = (error) => error.code === 'PUBLIC_EVIDENCE_REFUSED';
function chunk(type, payload = Buffer.alloc(0)) {
  const body = Buffer.concat([Buffer.from(type), payload]);
  const bytes = Buffer.alloc(body.length + 8);
  bytes.writeUInt32BE(payload.length, 0);
  body.copy(bytes, 4);
  bytes.writeUInt32BE(crc32(body), bytes.length - 4);
  return bytes;
}
const header = Buffer.from('00000001000000010806000000', 'hex');
const pixels = Buffer.from([0, 0, 0, 0, 255]);
const image = deflateSync(pixels);
const png = (...metadata) =>
  Buffer.concat([
    signature,
    chunk('IHDR', header),
    ...metadata,
    chunk('IDAT', image),
    chunk('IEND'),
  ]);

test('native screenshot profile preserves exact PNG bytes and dimensions', () => {
  const bytes = png();
  const original = Buffer.from(bytes);
  assert.deepEqual(assertPublicScreenshot(bytes), { width: 1, height: 1 });
  assert.ok(bytes.equals(original));
  assert.ok(inflateSync(image).equals(pixels));
});

test('CRC-valid compressed private metadata refuses without decoding or rewriting pixels', () => {
  const secret = Buffer.from('SyntheticPrivateFigmaFileKey');
  const compressed = deflateSync(secret);
  assert.ok(inflateSync(compressed).equals(secret));
  const metadata = Buffer.concat([Buffer.from('Comment\0\0'), compressed]);
  const bytes = png(chunk('zTXt', metadata));
  assert.equal(bytes.includes(secret), false);
  assert.throws(() => assertPublicScreenshot(bytes), refused);
  for (const type of ['tEXt', 'iTXt', 'iCCP', 'eXIf', 'acTL', 'vpAg'])
    assert.throws(() => assertPublicScreenshot(png(chunk(type, metadata))), refused);
});

test('compressed bytes after the image stream refuse instead of leaking nonpixel metadata', () => {
  const hidden = deflateSync(Buffer.from('SyntheticPrivateFigmaFileKey'));
  const idat = Buffer.concat([image, hidden]);
  const bytes = Buffer.concat([
    signature,
    chunk('IHDR', header),
    chunk('IDAT', idat),
    chunk('IEND'),
  ]);
  assert.ok(inflateSync(idat).equals(pixels));
  assert.throws(() => assertPublicScreenshot(bytes), refused);
});

test('CRC-valid high bits in chunk types refuse without ASCII normalization', () => {
  const chunks = [
    ['IHDR', header],
    ['IDAT', image],
    ['IEND', Buffer.alloc(0)],
  ];
  for (let index = 0; index < chunks.length; index++) {
    for (let byte = 0; byte < 4; byte++) {
      const altered = chunks.map(([name, payload], position) => {
        const type = Buffer.from(name);
        if (position === index) type[byte] |= 0x80;
        return chunk(type, payload);
      });
      assert.throws(() => assertPublicScreenshot(Buffer.concat([signature, ...altered])), refused);
    }
  }
});

test('damaged lengths, CRC, critical ordering and trailing bytes refuse', () => {
  const damaged = png();
  damaged[damaged.length - 1] ^= 1;
  const overflow = png();
  overflow.writeUInt32BE(0xffffffff, 8);
  for (const bytes of [
    damaged,
    overflow,
    png().subarray(0, -1),
    Buffer.concat([png(), Buffer.from([0])]),
    Buffer.concat([signature, chunk('IDAT', image), chunk('IHDR', header), chunk('IEND')]),
    Buffer.concat([
      signature,
      chunk('IHDR', header),
      chunk('IHDR', header),
      chunk('IDAT', image),
      chunk('IEND'),
    ]),
  ])
    assert.throws(() => assertPublicScreenshot(bytes), refused);
});
