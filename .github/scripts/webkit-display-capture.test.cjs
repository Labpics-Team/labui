const assert = require('node:assert/strict');
const test = require('node:test');
const { MARKERS, STATE, COLORS, analyze } = require('./webkit-display-capture.cjs');

function fixture(filter, options = {}) {
  const width = 800;
  const height = 600;
  const ox = 80;
  const oy = 40;
  const data = Buffer.alloc(width * height * 4, 255);
  const paint = (x, y, w, h, rgb) => {
    for (let py = y; py < y + h; py++)
      for (let px = x; px < x + w; px++)
        for (let c = 0; c < 3; c++) data[(py * width + px) * 4 + c] = rgb[c];
  };
  for (const [i, marker] of MARKERS.entries())
    if (i !== options.missingMarker) paint(ox + marker.x, oy + marker.y, 16, 16, marker.rgb);
  paint(
    ox + STATE.x,
    oy + STATE.y,
    16,
    16,
    options.stale ? STATE.on : filter === 'none' ? STATE.off : STATE.on,
  );
  for (let x = 224; x < 352; x++)
    paint(
      ox + x,
      oy + 184,
      1,
      64,
      options.blank
        ? [255, 255, 255]
        : filter === 'none'
          ? COLORS[Math.floor(x / 8) % 2]
          : [147, 139, 176],
    );
  return { width, height, data };
}

test('calibration recovers the viewport offset and the same physical ROI', () => {
  const off = analyze(fixture('none'), 'none');
  const on = analyze(fixture('blur(48px)'), 'blur(48px)');
  assert.equal(off.valid, true);
  assert.equal(on.valid, true);
  assert.deepEqual(off.origin, { x: 80, y: 40 });
  assert.deepEqual(off.rect, { x: 304, y: 224, width: 128, height: 64 });
  assert.ok(off.signal > 8);
  assert.equal(on.signal, 0);
});

test('blank and occluded captures cannot qualify as a visible viewport', () => {
  assert.equal(
    analyze({ width: 800, height: 600, data: Buffer.alloc(800 * 600 * 4) }, 'none').valid,
    false,
  );
  assert.equal(analyze(fixture('none', { missingMarker: 3 }), 'none').valid, false);
  assert.equal(analyze(fixture('none', { blank: true }), 'none').valid, false);
  assert.equal(analyze(fixture('blur(48px)', { blank: true }), 'blur(48px)').valid, false);
});

test('a previous frame cannot stand in for the off control', () => {
  assert.equal(analyze(fixture('none', { stale: true }), 'none').valid, false);
});

test('Retina pixels preserve the CSS-scale signal and ROI', () => {
  const source = fixture('none');
  const width = source.width * 2;
  const height = source.height * 2;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const offset = (Math.floor(y / 2) * source.width + Math.floor(x / 2)) * 4;
      source.data.copy(data, (y * width + x) * 4, offset, offset + 4);
    }
  const actual = analyze({ width, height, data }, 'none');
  assert.equal(actual.valid, true);
  assert.deepEqual(actual.origin, { x: 160, y: 80 });
  assert.deepEqual(actual.rect, { x: 608, y: 448, width: 256, height: 128 });
  assert.equal(actual.signal, analyze(source, 'none').signal);
});

test('ambiguous markers cannot choose a convenient viewport', () => {
  const image = fixture('none');
  for (let y = 550; y < 566; y++)
    for (let x = 0; x < 16; x++)
      for (let c = 0; c < 3; c++) image.data[(y * image.width + x) * 4 + c] = MARKERS[0].rgb[c];
  assert.equal(analyze(image, 'none').valid, false);
});
