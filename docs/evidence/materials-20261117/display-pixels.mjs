import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

/** Page.screenshot() can omit backdrop filters while the display renders them.
 * Read the compositor instead. A page marker determines origin and screen scale,
 * without browser chrome offsets. See Playwright issue43646 / Mozilla1657997.
 */
export async function displayPixels(page, xs) {
  let frame;
  if (process.platform === 'linux') {
    const data = await readFile(process.env.XWD_FILE);
    const words = Array.from({ length: 25 }, (_, i) => data.readUInt32BE(i * 4));
    assert.equal(words[1], 7, 'XWD version');
    assert.equal(words[3], 24, 'display depth');
    assert.equal(words[11], 32, 'framebuffer pixel width');
    const width = words[4];
    const height = words[5];
    assert(width > 0 && width <= 4096 && height > 0 && height <= 4096);
    const start = words[0] + words[19] * 12;
    const read = words[7] === 0 ? data.readUInt32LE.bind(data) : data.readUInt32BE.bind(data);
    const shifts = words.slice(14, 17).map((mask) => 31 - Math.clz32(mask & -mask));
    const pixels = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixel = read(start + y * words[12] + x * 4);
        const offset = (y * width + x) * 4;
        for (let channel = 0; channel < 3; channel++)
          pixels[offset + channel] = (pixel >>> shifts[channel]) & 255;
        pixels[offset + 3] = 255;
      }
    }
    frame = { width, height, pixels };
  } else if (process.platform === 'darwin') {
    const directory = await mkdtemp(join(tmpdir(), 'labui-display-'));
    try {
      const path = join(directory, 'frame.png');
      await promisify(execFile)('/usr/sbin/screencapture', ['-x', '-t', 'png', path]);
      const png = await readFile(path);
      frame = await page.evaluate(async (base64) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        return {
          width: image.width,
          height: image.height,
          pixels: Array.from(context.getImageData(0, 0, image.width, image.height).data),
        };
      }, png.toString('base64'));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  } else {
    throw new Error('Display capture needs Xvfb on Linux or screencapture on macOS');
  }
  const { width, height, pixels } = frame;
  const isMarker = (offset) =>
    pixels[offset] === 7 && pixels[offset + 1] === 251 && pixels[offset + 2] === 137;
  let origin = -1;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (isMarker(offset)) {
      origin = offset / 4;
      break;
    }
  }
  assert(origin >= 0, 'page marker appears on the display');
  const x = origin % width;
  const y = Math.floor(origin / width);
  let markerWidth = 0;
  while (x + markerWidth < width && isMarker((origin + markerWidth) * 4)) markerWidth++;
  const scale = markerWidth / 4;
  assert(scale >= 1 && scale <= 3 && Number.isInteger(scale), 'marker has a whole screen scale');
  const sampleY = y + 50 * scale;
  assert(sampleY < height);
  return xs.map((cssX) => {
    const sampleX = x + cssX * scale;
    assert(sampleX < width);
    const at = (sampleY * width + sampleX) * 4;
    return Array.from(pixels.slice(at, at + 4));
  });
}
