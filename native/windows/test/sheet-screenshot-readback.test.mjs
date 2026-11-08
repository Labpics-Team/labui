import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { crc32, deflateSync, inflateSync } from 'node:zlib';
import {
  BACKDROP_FIXTURE,
  BACKDROP_FIXTURE_HASH,
  BACKDROP_PAINTS,
  assertBackdropNeighbor,
  backdropAssets,
  backdropHash,
  backdropProbeRegions,
  createBackdropNeighbor,
  validateBackdropWitness,
} from './sheet-backdrop-fixture.mjs';
import {
  sheetMaterialPixelFailures,
  sheetMaterialPixels,
  sheetOrderPixelFailures,
  sheetOrderPixels,
} from './sheet-material-pixels.mjs';
import { ORDER_BACKDROPS } from './sheet-order-fixture.mjs';
import {
  CAPTURE_CASES,
  CASES,
  decodeSheetDiagnosticEvidence,
  decodeSheetEvidence,
  encodeSheetCaptureEvidence,
  encodeSheetEvidence,
  publishSheetCaptureEvidence,
  sheetFailureLog,
} from './sheet.mjs';

// Инертный replay JSON-диагностики; native capture и runner fixtures не запускаются.
const record = (value = {}) =>
  JSON.parse(
    sheetFailureLog({
      sourceSha: 'a'.repeat(40),
      name: 'Content-List',
      phase: 'screenshot-image',
      pid: 42,
      observation: null,
      error: new assert.AssertionError({ message: 'PRIVATE_CAPTURE_TEXT' }),
      stderrBytes: 0,
      ...value,
    }).slice('LABUI_SHEET_FAILURE_JSON '.length),
  );

test('screenshot failure retains command status and measured dimensions', () => {
  const value = record({
    screenshot: {
      exitCode: 0,
      replyIsObject: true,
      image: { width: 375, height: 749 },
      stdout: 'PRIVATE_CAPTURE_TEXT',
    },
  });
  assert.equal(value.phase, 'screenshot-image');
  assert.deepEqual(value.screenshot, {
    exitCode: 0,
    replyIsObject: true,
    image: { width: 375, height: 749 },
  });
  assert.ok(!JSON.stringify(value).includes('PRIVATE_CAPTURE_TEXT'));
  for (const phase of ['screenshot-command', 'screenshot-reply', 'screenshot-process'])
    assert.equal(record({ phase }).phase, phase);
});

test('screenshot diagnostics discard corrupt shapes and unbounded fields', () => {
  assert.equal(record({ screenshot: ['PRIVATE_CAPTURE_TEXT'] }).screenshot, null);
  for (const exitCode of [Number.POSITIVE_INFINITY, '0', -2147483649, 4294967296, 0.5]) {
    const value = record({
      screenshot: {
        exitCode,
        replyIsObject: 'true',
        image: { width: -375, height: '812', message: 'PRIVATE_CAPTURE_TEXT' },
      },
    });
    assert.deepEqual(value.screenshot, {
      exitCode: null,
      replyIsObject: null,
      image: { width: null, height: null },
    });
    assert.ok(!JSON.stringify(value).includes('PRIVATE_CAPTURE_TEXT'));
  }
});

test('failures before screenshot preserve the existing record shape', () => {
  const value = record({ phase: 'render' });
  assert.equal(value.phase, 'render');
  assert.equal(Object.hasOwn(value, 'screenshot'), false);
  assert.equal(record({ phase: 'screenshot' }).phase, 'screenshot');
});

// Инертные A/B PNG проверяют соседскую зависимость, не WinUI или Figma fidelity.
const SOURCE = 'a'.repeat(40);
const json = (value) => Buffer.from(JSON.stringify(value));
function backdropWitness(variant = 'A', height = 812) {
  return {
    schema: BACKDROP_FIXTURE.schema,
    variant,
    fixtureSha256: BACKDROP_FIXTURE_HASH,
    assetSha256: BACKDROP_FIXTURE.assets[variant].sha256,
    sourcePixels: { ...BACKDROP_FIXTURE.sourcePixels },
    image: {
      source: `ms-appx:///Assets/${BACKDROP_FIXTURE.assets[variant].file}`,
      bitmapPixels: { ...BACKDROP_FIXTURE.sourcePixels },
      bounds: { x: 0, y: 0, width: 375, height },
      stretch: 'UniformToFill',
      horizontalAlignment: 'Stretch',
      verticalAlignment: 'Stretch',
    },
    fit: {
      scale: Math.max(
        375 / BACKDROP_FIXTURE.sourcePixels.width,
        height / BACKDROP_FIXTURE.sourcePixels.height,
      ),
      offsetX: 0,
      offsetY: 0,
    },
    paints: Object.fromEntries(
      BACKDROP_PAINTS.map((name) => [name, { rgba: [127, 127, 127, 128], opacity: 0.5 }]),
    ),
  };
}
const BINDINGS = { A: backdropWitness('A'), B: backdropWitness('B') };
const REGIONS = backdropProbeRegions(BINDINGS.A);
const ORDER_BINDINGS = Object.fromEntries(
  ORDER_BACKDROPS.map((variant) => [variant, backdropWitness(variant)]),
);

function pngChunk(name, payload) {
  const bytes = Buffer.alloc(payload.length + 12);
  bytes.writeUInt32BE(payload.length);
  bytes.write(name, 4, 'ascii');
  payload.copy(bytes, 8);
  bytes.writeUInt32BE(crc32(bytes.subarray(4, -4)), bytes.length - 4);
  return bytes;
}

function fixtureRgba(bytes) {
  // Только два формата фильтра известного fixture; общий Colors decoder не меняется.
  assert.equal(bytes[24], 8);
  assert.equal(bytes[25], 6);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const data = [];
  const chunks = [];
  for (let offset = 8; offset < bytes.length; ) {
    const length = bytes.readUInt32BE(offset);
    const name = bytes.toString('ascii', offset + 4, offset + 8);
    if (name === 'IDAT') data.push(bytes.subarray(offset + 8, offset + 8 + length));
    else if (name !== 'IEND') chunks.push(bytes.subarray(offset, offset + length + 12));
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * 4;
  assert.equal(raw.length, (stride + 1) * height);
  const rgba = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    assert.ok(filter === 0 || filter === 1);
    for (let x = 0; x < stride; x++) {
      const offset = y * stride + x;
      rgba[offset] =
        (raw[y * (stride + 1) + 1 + x] + (filter === 1 && x >= 4 ? rgba[offset - 4] : 0)) & 255;
    }
  }
  return { width, height, rgba, raw, chunks };
}

test('neighbor asset preserves authored RGBA outside the declared opaque source rectangle', () => {
  const assets = backdropAssets();
  assert.equal(
    BACKDROP_FIXTURE.assets.A.sha256,
    'df0d29601d3863f9f2375e1c4fa928365515732da40ba33876a25a3734638f99',
  );
  assert.equal(backdropHash(assets.A), BACKDROP_FIXTURE.assets.A.sha256);
  assert.equal(backdropHash(assets.B), BACKDROP_FIXTURE.assets.B.sha256);
  assert.deepEqual(BACKDROP_FIXTURE.sourcePixels, { width: 1733, height: 4096 });
  assert.deepEqual(BACKDROP_FIXTURE.changedSourceRect, {
    x: 1120,
    y: 1480,
    width: 260,
    height: 620,
  });
  assert.deepEqual(BACKDROP_FIXTURE.replacementRgba, [0, 0, 0, 255]);
  assert.equal(BACKDROP_FIXTURE.resamplingMargin, 4);
  const original = fixtureRgba(assets.A);
  const neighbor = fixtureRgba(assets.B);
  const rect = BACKDROP_FIXTURE.changedSourceRect;
  let outsideChanges = 0;
  let insideMismatch = 0;
  let changedPixels = 0;
  let alphaChanges = 0;
  let nonopaquePixels = 0;
  for (let y = 0; y < original.height; y++)
    for (let x = 0; x < original.width; x++) {
      const offset = (y * original.width + x) * 4;
      const inside =
        x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
      let changed = false;
      for (let channel = 0; channel < 4; channel++) {
        changed ||= original.rgba[offset + channel] !== neighbor.rgba[offset + channel];
        if (inside && neighbor.rgba[offset + channel] !== BACKDROP_FIXTURE.replacementRgba[channel])
          insideMismatch++;
      }
      changedPixels += changed ? 1 : 0;
      outsideChanges += !inside && changed ? 1 : 0;
      alphaChanges += original.rgba[offset + 3] !== neighbor.rgba[offset + 3] ? 1 : 0;
      nonopaquePixels += original.rgba[offset + 3] !== 255 ? 1 : 0;
    }
  assert.equal(outsideChanges, 0);
  assert.equal(insideMismatch, 0);
  assert.equal(alphaChanges, 0);
  assert.ok(changedPixels > 0 && changedPixels <= rect.width * rect.height);
  assert.ok(nonopaquePixels > 0, 'authored border alpha must be retained');
  const alteredSource = Buffer.from(assets.A);
  alteredSource[alteredSource.length - 1] ^= 1;
  assert.throws(() => createBackdropNeighbor(alteredSource));
});

test('intervention proof ignores deflate representation while rejecting changed scanlines and metadata', () => {
  const assets = backdropAssets();
  const decoded = fixtureRgba(assets.B);
  const encode = (raw, chunks = decoded.chunks) =>
    Buffer.concat([
      assets.B.subarray(0, 8),
      ...chunks,
      pngChunk('IDAT', deflateSync(raw, { level: 1 })),
      pngChunk('IEND', Buffer.alloc(0)),
    ]);
  const recompressed = encode(decoded.raw);
  assert.notEqual(backdropHash(recompressed), BACKDROP_FIXTURE.assets.B.sha256);
  assert.doesNotThrow(() => assertBackdropNeighbor(assets.A, recompressed));
  const altered = Buffer.from(decoded.raw);
  altered[100 * (decoded.width * 4 + 1) + 1 + 100 * 4] ^= 1;
  assert.throws(() => assertBackdropNeighbor(assets.A, encode(altered)), /source intervention/);
  const addedMetadata = [...decoded.chunks, pngChunk('tEXt', Buffer.from('fixture\0unknown'))];
  assert.throws(
    () => assertBackdropNeighbor(assets.A, encode(decoded.raw, addedMetadata)),
    /metadata differs/,
  );
});

test('order inputs retain opaque constant controls and 16-DIP alternating stripes', () => {
  const assets = backdropAssets();
  for (const variant of ORDER_BACKDROPS) {
    const image = fixtureRgba(assets[variant]);
    for (let x = 0; x < image.width; x++) {
      const value =
        variant === 'OrderStripes'
          ? (Math.floor(((x + 0.5) * 375) / image.width / 16) % 2) * 255
          : { OrderBlack: 0, OrderWhite: 255, OrderGray: 128 }[variant];
      for (const y of [0, 1480, image.height - 1])
        assert.deepEqual(
          [...image.rgba.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)],
          [value, value, value, 255],
        );
    }
  }
});

test('probe regions stay outside the resampling margin for observed top-left image fits', () => {
  for (const height of [812, 886.3242931332949, 887]) {
    const witness = backdropWitness('A', height);
    assert.equal(validateBackdropWitness(witness, 'A'), witness);
    const regions = backdropProbeRegions(witness);
    assert.ok(regions.ghost.y + regions.ghost.height < 380);
    assert.ok(regions.body.y >= 438);
    for (const region of [
      regions.ghost,
      regions.ghostFurther,
      regions.body,
      regions.bodyOpposite,
      regions.control,
    ])
      assert.ok(
        region.x + region.width <= regions.footprint.x - regions.margin ||
          region.x >= regions.footprint.x + regions.footprint.width + regions.margin ||
          region.y + region.height <= regions.footprint.y - regions.margin ||
          region.y >= regions.footprint.y + regions.footprint.height + regions.margin,
      );
  }
});

const rasterSources = ['A', 'B'].map((variant) => {
  const rgb = new Uint8Array(375 * 812 * 3);
  const footprint = REGIONS.footprint;
  for (let y = 0; y < 812; y++)
    for (let x = 0; x < 375; x++) {
      const changed =
        variant === 'B' &&
        x >= Math.floor(footprint.x) &&
        x < Math.ceil(footprint.x + footprint.width) &&
        y >= Math.floor(footprint.y) &&
        y < Math.ceil(footprint.y + footprint.height);
      const checker = ((Math.floor(x / 19) + Math.floor(y / 27)) % 2) * 60;
      for (let channel = 0; channel < 3; channel++)
        rgb[(y * 375 + x) * 3 + channel] = changed
          ? 0
          : 50 + channel * 30 + ((x * 3 + y * 5) % 31) + checker;
    }
  return { width: 375, height: 812, rgb };
});
const summedSources = rasterSources.map((image) => {
  const stride = image.width + 1;
  return Array.from({ length: 3 }, (_, channel) => {
    const table = new Float64Array(stride * (image.height + 1));
    for (let y = 0; y < image.height; y++) {
      let row = 0;
      for (let x = 0; x < image.width; x++) {
        row += image.rgb[(y * image.width + x) * 3 + channel];
        table[(y + 1) * stride + x + 1] = table[y * stride + x + 1] + row;
      }
    }
    return table;
  });
});
function boxAt(table, x, y, radius) {
  const left = Math.max(0, x - radius);
  const right = Math.min(375, x + radius + 1);
  const top = Math.max(0, y - radius);
  const bottom = Math.min(812, y + radius + 1);
  return (
    (table[bottom * 376 + right] -
      table[top * 376 + right] -
      table[bottom * 376 + left] +
      table[top * 376 + left]) /
    ((right - left) * (bottom - top))
  );
}
const clampByte = (value) => Math.max(0, Math.min(255, Math.round(value)));
const orderImagesCache = new Map();
const orderSourceRows = new Map();
function orderSourceRow(height) {
  if (!orderSourceRows.has(height)) {
    const image = fixtureRgba(backdropAssets().OrderStripes);
    const scale = Math.max(375 / image.width, height / image.height);
    orderSourceRows.set(
      height,
      Array.from({ length: 375 }, (_, x) => {
        const sourceX = (x + 0.5) / scale - 0.5;
        const left = Math.max(0, Math.min(image.width - 2, Math.floor(sourceX)));
        const fraction = sourceX - left;
        return image.rgba[left * 4] * (1 - fraction) + image.rgba[(left + 1) * 4] * fraction;
      }),
    );
  }
  return orderSourceRows.get(height);
}
function orderImages(theme = 'Light', order = 'paint-before-blur', height = 812, phase = 0) {
  const key = `${theme}/${order}/${height}/${phase}`;
  if (orderImagesCache.has(key)) return orderImagesCache.get(key);
  assert.ok(['paint-before-blur', 'blur-before-paint', 'sharp', 'no-control-gap'].includes(order));
  // Inert finite/clamped convolution with the actual asset's linear resampling
  // calibrates the meter and its negative controls, including broad edge gradients.
  // These are not native captures or expected fidelity reference images.
  const paint = (value) => {
    if (order === 'no-control-gap') return 40 + value * 0.4;
    const tint = theme === 'Light' ? 204 : 104;
    const background = (tint + value * 0.2) / 255;
    const foreground = (theme === 'Light' ? 38 : 31) / 255;
    return (
      255 *
      (theme === 'Light'
        ? Math.min(1, background / (1 - foreground))
        : background <= 0.5
          ? 2 * background * foreground
          : 1 - 2 * (1 - background) * (1 - foreground))
    );
  };
  const sigma = 64;
  const kernel = Array.from({ length: 6 * sigma + 1 }, (_, i) =>
    Math.exp(-((i - 3 * sigma) ** 2) / (2 * sigma ** 2)),
  );
  const mass = kernel.reduce((sum, value) => sum + value, 0);
  const sourceRow = orderSourceRow(height);
  const source = (x) => sourceRow[Math.max(0, Math.min(374, x))];
  const stripes = Array.from({ length: 375 }, (_, x) => {
    if (order === 'sharp') return paint(source((x + phase) % 375));
    const before = order !== 'blur-before-paint';
    const blurred =
      kernel.reduce((sum, weight, i) => {
        const value = source(x + i - 3 * sigma);
        return sum + weight * (before ? paint(value) : value);
      }, 0) / mass;
    return before ? blurred : paint(blurred);
  });
  const images = Object.fromEntries(
    ORDER_BACKDROPS.map((variant) => {
      const rgb = new Uint8Array(375 * 812 * 3);
      for (let y = 0; y < 812; y++)
        for (let x = 0; x < 375; x++)
          for (let channel = 0; channel < 3; channel++) {
            const value =
              variant === 'OrderStripes'
                ? stripes[x]
                : paint({ OrderBlack: 0, OrderWhite: 255, OrderGray: 128 }[variant]);
            const noiseAlpha = ((x * 7 + y * 11 + channel * 3) % 5) * 0.08;
            rgb[(y * 375 + x) * 3 + channel] = clampByte(
              value * (1 - noiseAlpha) + (channel + 1) * noiseAlpha,
            );
          }
      return [variant, { width: 375, height: 812, rgb }];
    }),
  );
  orderImagesCache.set(key, images);
  return images;
}

test('order meter accepts paint before convolution and rejects wrong order sharp stripes and nondiscriminating controls', () => {
  for (const theme of ['Light', 'Dark']) {
    const correct = sheetOrderPixels(orderImages(theme), ORDER_BINDINGS);
    assert.deepEqual(sheetOrderPixelFailures(correct), [], theme);
    assert.ok(correct.controlGap >= 4);
    for (const [mode, message] of [
      ['blur-before-paint', /stripe mean/],
      ['sharp', /sharp spatial variation/],
      ['no-control-gap', /controls do not distinguish/],
    ]) {
      const report = sheetOrderPixels(orderImages(theme, mode), ORDER_BINDINGS);
      assert.ok(
        sheetOrderPixelFailures(report).some((failure) => message.test(failure)),
        `${theme}/${mode}`,
      );
    }
  }
});

test('order meter accepts finite clamped edges at both admitted image fits and rejects every tested sharp stripe phase', (t) => {
  for (const height of [812, 887])
    for (const theme of ['Light', 'Dark']) {
      const bindings = Object.fromEntries(
        ORDER_BACKDROPS.map((variant) => [variant, backdropWitness(variant, height)]),
      );
      const correct = sheetOrderPixels(orderImages(theme, 'paint-before-blur', height), bindings);
      assert.deepEqual(sheetOrderPixelFailures(correct), [], `${theme}/${height}`);
      const reversed = sheetOrderPixels(orderImages(theme, 'blur-before-paint', height), bindings);
      assert.ok(sheetOrderPixelFailures(reversed).some((failure) => /stripe mean/.test(failure)));
      t.diagnostic(
        JSON.stringify({
          theme,
          height,
          controlGap: correct.controlGap,
          endpointError: correct.endpointError,
          stripeResidualAmplitude: correct.stripeResidualAmplitude,
          reversedEndpointError: reversed.endpointError,
          native: 'pending',
        }),
      );
      if (theme === 'Dark')
        assert.ok(
          correct.columnResidualSpan > 3,
          'a broad lawful edge gradient must remain accepted',
        );
      for (const phase of [0, 1, 8, 15]) {
        const sharp = sheetOrderPixels(orderImages(theme, 'sharp', height, phase), bindings);
        assert.ok(
          sheetOrderPixelFailures(sharp).some((failure) => /sharp spatial variation/.test(failure)),
          `${theme}/${height}/${phase}`,
        );
      }
    }
});

test('order meter binds all four actual image geometries and paints', () => {
  for (const variant of ORDER_BACKDROPS) {
    const bindings = structuredClone(ORDER_BINDINGS);
    bindings[variant].paints.tint.opacity = 0.6;
    assert.throws(() => sheetOrderPixels(orderImages(), bindings), /paints differ/);
    const images = { ...orderImages(), [variant]: { ...orderImages()[variant], width: 374 } };
    assert.throws(() => sheetOrderPixels(images, ORDER_BINDINGS));
  }
});

const pairs = new Map();
function materialPair({ ghost = 'convolution', body = 'convolution' } = {}) {
  const key = `${ghost}/${body}`;
  if (pairs.has(key)) return pairs.get(key);
  const images = rasterSources.map((image, variant) => {
    const rgb = new Uint8Array(image.rgb.length);
    for (let y = 0; y < image.height; y++)
      for (let x = 0; x < image.width; x++)
        for (let channel = 0; channel < 3; channel++) {
          const offset = (y * image.width + x) * 3 + channel;
          const point = image.rgb[offset];
          const mode = y < 390 ? ghost : body;
          let value = point;
          if (mode === 'convolution') {
            const radius = y < 390 ? Math.max(1, Math.round((24 * y) / 390)) : 128;
            value = boxAt(summedSources[variant][channel], x, y, radius);
          } else if (mode === 'gray') value = 127;
          else if (mode === 'sigmoid') value = 255 + (point - 255) / (1 + Math.exp((y - 300) / 4));
          else if (mode.startsWith('linear-')) {
            const veil = Number(mode.slice('linear-'.length));
            value = veil + (point - veil) * (1 - y / 390);
          } else if (mode === 'colored-copy') value = 127 + 0.75 * (point - 127);
          else assert.equal(mode, 'sharp');
          const noise = ((x * 7 + y * 11 + channel * 3) % 5) - 2;
          rgb[offset] = clampByte(value + noise);
        }
    return { width: image.width, height: image.height, rgb };
  });
  const pair = { original: images[0], neighbor: images[1] };
  pairs.set(key, pair);
  return pair;
}
const reportFor = (pair, bindings = BINDINGS) =>
  sheetMaterialPixels(pair.original, pair.neighbor, bindings);

test('actual inert convolutions respond independently in Ghost and Body outside changed input support', () => {
  const pair = materialPair();
  const report = reportFor(pair);
  assert.deepEqual(sheetMaterialPixelFailures(report), []);
  assert.ok(report.ghost.changedPixels > 0);
  assert.ok(report.ghost.meanDarkening > report.ghostFurther.meanDarkening);
  assert.ok(report.body.changedPixels > 0);
  assert.equal(report.control.changedPixels, 0);
  // Широкий Body может реагировать далеко от R; stable far Body не является условием.
  const farBody = (500 * 375 + 320) * 3;
  assert.ok(pair.neighbor.rgb[farBody] < pair.original.rgb[farBody]);
  for (const [options, missing, present] of [
    [{ ghost: 'sharp' }, 'Ghost', 'Body'],
    [{ ghost: 'gray' }, 'Ghost', 'Body'],
    [{ body: 'sharp' }, 'Body', 'Ghost'],
    [{ body: 'gray' }, 'Body', 'Ghost'],
  ]) {
    const failures = sheetMaterialPixelFailures(reportFor(materialPair(options)));
    assert.ok(failures.some((failure) => failure.startsWith(missing)));
    assert.ok(!failures.some((failure) => failure.startsWith(present)));
  }
});

test('authored Body paints retain a sensitive opposite sample when Light ColorDodge clips the left sample', async () => {
  // Математическая калибровка областей на настоящем asset и опубликованных красках.
  // Она не исполняет native renderer и не квалифицирует его Gaussian/Figma fidelity.
  const resources = await readFile(
    new URL('../generated/ThemeResources.g.xaml', import.meta.url),
    'utf8',
  );
  const assets = backdropAssets();
  const images = [fixtureRgba(assets.A), fixtureRgba(assets.B)];
  const sigma = 64;
  const radius = 3 * sigma;
  const kernel = Array.from({ length: 2 * radius + 1 }, (_, i) =>
    Math.exp(-((i - radius) ** 2) / (2 * sigma * sigma)),
  );
  const mass = kernel.reduce((sum, value) => sum + value, 0);
  for (let i = 0; i < kernel.length; i++) kernel[i] /= mass;
  for (const theme of ['Light', 'Dark']) {
    const dictionary = resources.match(
      new RegExp(`<ResourceDictionary x:Key="${theme}">([\\s\\S]*?)</ResourceDictionary>`),
    )?.[1];
    assert.ok(dictionary);
    const paint = (name) => {
      const match = dictionary.match(
        new RegExp(`x:Key="${name}" Color="#([A-F0-9]{6})" Opacity="([0-9.]+)"`),
      );
      assert.ok(match, name);
      return {
        rgb: match[1].match(/../g).map((part) => Number.parseInt(part, 16)),
        opacity: Number(match[2]),
      };
    };
    const page = paint('LabPageBrush');
    const tint = paint('LabSheetTintBrush');
    const blend = paint('LabSheetBlendBrush');
    const noise = paint('LabSheetNoiseBrush');
    const mapped = images.map((image) => {
      const rgb = new Float64Array(375 * 812 * 3);
      for (let y = 0; y < 812; y++)
        for (let x = 0; x < 375; x++) {
          const sx = (x + 0.5) / BINDINGS.A.fit.scale - 0.5;
          const sy = (y + 0.5) / BINDINGS.A.fit.scale - 0.5;
          const x0 = Math.max(0, Math.min(image.width - 2, Math.floor(sx)));
          const y0 = Math.max(0, Math.min(image.height - 2, Math.floor(sy)));
          for (let dy = 0; dy < 2; dy++)
            for (let dx = 0; dx < 2; dx++) {
              const weight = (dx ? sx - x0 : 1 - (sx - x0)) * (dy ? sy - y0 : 1 - (sy - y0));
              const offset = ((y0 + dy) * image.width + x0 + dx) * 4;
              const alpha = image.rgba[offset + 3] / 255;
              for (let c = 0; c < 3; c++)
                rgb[(y * 375 + x) * 3 + c] +=
                  weight * (alpha * image.rgba[offset + c] + (1 - alpha) * page.rgb[c]);
            }
        }
      return rgb;
    });
    const convolve = (data, x, y) => {
      const value = [0, 0, 0];
      for (let dy = -radius; dy <= radius; dy++)
        for (let dx = -radius; dx <= radius; dx++) {
          const offset =
            (Math.max(0, Math.min(811, y + dy)) * 375 + Math.max(0, Math.min(374, x + dx))) * 3;
          const weight = kernel[dy + radius] * kernel[dx + radius];
          for (let c = 0; c < 3; c++) value[c] += weight * data[offset + c];
        }
      return value;
    };
    const applyPaint = (value, x, y) =>
      value.map((channel, c) => {
        const background = (tint.rgb[c] * tint.opacity + channel * (1 - tint.opacity)) / 255;
        const foreground = blend.rgb[c] / 255;
        const blended =
          theme === 'Light'
            ? Math.min(1, background / (1 - foreground))
            : background <= 0.5
              ? 2 * background * foreground
              : 1 - 2 * (1 - background) * (1 - foreground);
        const painted = 255 * (blended * blend.opacity + background * (1 - blend.opacity));
        const noiseAlpha = (0.04 * noise.opacity * ((x * 7 + y * 11) % 13)) / 12;
        return clampByte(painted * (1 - noiseAlpha) + noise.rgb[c] * noiseAlpha);
      });
    for (const mode of ['convolution', 'sharp']) {
      const base = materialPair();
      const pair = Object.fromEntries(
        ['original', 'neighbor'].map((name, variant) => {
          const image = { ...base[name], rgb: Uint8Array.from(base[name].rgb) };
          for (const region of [REGIONS.body, REGIONS.bodyOpposite])
            for (let y = region.y; y < region.y + region.height; y++)
              for (let x = region.x; x < region.x + region.width; x++) {
                const offset = (y * 375 + x) * 3;
                const value =
                  mode === 'convolution'
                    ? convolve(mapped[variant], x, y)
                    : [...mapped[variant].subarray(offset, offset + 3)];
                image.rgb.set(applyPaint(value, x, y), offset);
              }
          return [name, image];
        }),
      );
      const report = reportFor(pair);
      if (mode === 'convolution') {
        assert.deepEqual(sheetMaterialPixelFailures(report), [], theme);
        assert.ok(report.bodyOpposite.changedPixels > 0, theme);
        if (theme === 'Light')
          assert.equal(
            report.body.changedPixels,
            0,
            'actual Light paint clips the former lone sample',
          );
      } else {
        assert.equal(report.body.changedPixels, 0);
        assert.equal(report.bodyOpposite.changedPixels, 0);
        assert.deepEqual(sheetMaterialPixelFailures(report), [
          'Body has no coherent neighbor response outside changed source footprint',
        ]);
      }
    }
  }
});

test('linear and confirmed sigmoid pointwise Ghost veils have no neighbor response', () => {
  for (const ghost of ['linear-0', 'linear-127', 'linear-255', 'sigmoid']) {
    const report = reportFor(materialPair({ ghost }));
    assert.equal(report.ghost.changedPixels, 0, ghost);
    const failures = sheetMaterialPixelFailures(report);
    assert.ok(
      failures.some((failure) => failure.startsWith('Ghost')),
      ghost,
    );
    assert.ok(!failures.some((failure) => failure.startsWith('Body')), ghost);
  }
});

test('confirmed sharp colored Body copy fails independently of healthy Ghost convolution', () => {
  const pair = materialPair({ body: 'colored-copy' });
  const report = reportFor(pair);
  const offset = (report.regions.body.y * 375 + report.regions.body.x) * 3;
  assert.notEqual(pair.original.rgb[offset], pair.original.rgb[offset + 2]);
  assert.equal(report.body.changedPixels, 0);
  const failures = sheetMaterialPixelFailures(report);
  assert.ok(failures.some((failure) => failure.startsWith('Body')));
  assert.ok(!failures.some((failure) => failure.startsWith('Ghost')));
});

test('either Body side may clip while the other retains a coherent response', () => {
  const positive = materialPair();
  for (const name of ['body', 'bodyOpposite']) {
    const rgb = Uint8Array.from(positive.neighbor.rgb);
    const region = REGIONS[name];
    for (let y = region.y; y < region.y + region.height; y++)
      for (let x = region.x; x < region.x + region.width; x++) {
        const offset = (y * 375 + x) * 3;
        rgb.set(positive.original.rgb.subarray(offset, offset + 3), offset);
      }
    const report = reportFor({
      original: positive.original,
      neighbor: { ...positive.neighbor, rgb },
    });
    assert.equal(report[name].changedPixels, 0);
    assert.deepEqual(sheetMaterialPixelFailures(report), []);
  }
});

test('fresh noise and unrelated global frame changes cannot masquerade as neighbor response', () => {
  const positive = materialPair();
  for (const change of ['fresh-noise', -1, 1]) {
    const neighbor = {
      ...positive.neighbor,
      rgb: Uint8Array.from(positive.neighbor.rgb, (value, index) =>
        clampByte(value + (change === 'fresh-noise' ? (index % 5) - 2 : change)),
      ),
    };
    const report = reportFor({ original: positive.original, neighbor });
    assert.ok(report.control.changedPixels > 0);
    assert.ok(
      sheetMaterialPixelFailures(report).some((failure) =>
        failure.includes('far backdrop control'),
      ),
    );
  }
});

test('black intervention must darken coherently and Ghost response must decay with distance', () => {
  const positive = materialPair();
  for (const name of ['ghost', 'body', 'bodyOpposite']) {
    const region = REGIONS[name];
    const rgb = Uint8Array.from(positive.neighbor.rgb);
    const offset = (region.y * 375 + region.x) * 3;
    rgb[offset] = positive.original.rgb[offset] + 1;
    const report = reportFor({
      original: positive.original,
      neighbor: { ...positive.neighbor, rgb },
    });
    assert.equal(report[name].brightenedChannels, 1);
    assert.ok(
      sheetMaterialPixelFailures(report).some((failure) =>
        failure.startsWith(name === 'ghost' ? 'Ghost' : 'Body'),
      ),
    );
  }
  const rgb = Uint8Array.from(positive.neighbor.rgb);
  const farther = REGIONS.ghostFurther;
  for (let y = farther.y; y < farther.y + farther.height; y++)
    for (let x = farther.x; x < farther.x + farther.width; x++)
      for (let channel = 0; channel < 3; channel++) {
        const offset = (y * 375 + x) * 3 + channel;
        rgb[offset] = clampByte(positive.original.rgb[offset] - 50);
      }
  const report = reportFor({
    original: positive.original,
    neighbor: { ...positive.neighbor, rgb },
  });
  assert.ok(report.ghostFurther.meanDarkening > report.ghost.meanDarkening);
  assert.ok(
    sheetMaterialPixelFailures(report).some((failure) => failure.includes('does not decay')),
  );
});

function materialPng(image, filter = 0) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(image.width);
  header.writeUInt32BE(image.height, 4);
  header[8] = 8;
  header[9] = 2;
  const stride = image.width * 3 + 1;
  const raw = Buffer.alloc(stride * image.height);
  for (let y = 0; y < image.height; y++) {
    raw[y * stride] = filter;
    raw.set(image.rgb.subarray(y * image.width * 3, (y + 1) * image.width * 3), y * stride + 1);
  }
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
const pngs = new WeakMap();
function encodedImage(image) {
  if (!pngs.has(image)) pngs.set(image, materialPng(image));
  return pngs.get(image);
}
function materialFiles({ Light = {}, Dark = {}, areEffectsFast = false, legacy = false } = {}) {
  // Текущий набор или девять прежних inert DTO/PNG; capture/runner boundary не вызывается.
  const identity = {
    source: SOURCE,
    cases: {},
    cliVersion: '0.7.1',
    visualReview: 'pending',
    motion: 'not-qualified',
    performance: 'not-qualified',
    ...(!legacy
      ? { schema: BACKDROP_FIXTURE.schema, backdropFixtureSha256: BACKDROP_FIXTURE_HASH }
      : {}),
  };
  for (const field of [
    'appSha256',
    'consumerSha256',
    'uiSha256',
    'motionSha256',
    'cliZipSha256',
    'cliSha256',
  ])
    identity[field] = 'b'.repeat(64);
  const files = new Map();
  for (const { name, theme, material, backdrop = 'A' } of legacy ? CASES : CAPTURE_CASES) {
    const window = { pid: 42, windowHandle: '1234', startedAtUnixMs: 110 };
    identity.cases[name] = {
      pid: 42,
      startedAtUnixMs: 100,
      observedUntilUnixMs: 200,
      windowHandle: '1234',
      exited: true,
      windowBefore: window,
      windowAfter: window,
    };
    files.set(
      `${name}.json`,
      json({
        pid: 42,
        windowHandle: '1234',
        observedAtUnixMs: 150,
        theme,
        rasterizationScale: 1,
        viewport: { x: 0, y: 0, width: 375, height: 812 },
        body: { x: 0, y: 390, width: 375, height: 422 },
        handle: { x: 170, y: 404, width: 36, height: 4 },
        layoutReady: true,
        imageLoaded: true,
        rendererReady: true,
        requestedState: 'Half',
        geometryScale: 1,
        contentWitness: null,
        requestedMaterial: material,
        effectiveMaterial: material,
        materialReason: 'Requested',
        materialCapabilities: {
          advancedEffectsEnabled: true,
          areEffectsSupported: true,
          areEffectsFast,
        },
        error: null,
        ...(!legacy ? { backdropWitness: backdropWitness(backdrop) } : {}),
      }),
    );
    const pair = materialPair({ Light, Dark }[theme]);
    files.set(
      `${name}.png`,
      encodedImage(
        ORDER_BACKDROPS.includes(backdrop)
          ? orderImages(theme, { Light, Dark }[theme].order)[backdrop]
          : material === 'Solid'
            ? rasterSources[0]
            : backdrop === 'A'
              ? pair.original
              : pair.neighbor,
      ),
    );
  }
  files.set('identity.json', json(identity));
  return files;
}
function mutateJson(files, name, mutate) {
  const value = JSON.parse(files.get(name));
  mutate(value);
  return new Map(files).set(name, json(value));
}

test('causal publication preserves exact capture codec bytes and historical nine-file decoding', (t) => {
  const files = materialFiles();
  assert.equal(files.size, 29);
  const checkedStart = performance.now();
  const evidence = encodeSheetCaptureEvidence(files, SOURCE);
  const checkedMs = performance.now() - checkedStart;
  const structuralStart = performance.now();
  const structural = encodeSheetEvidence(files, SOURCE);
  const structuralMs = performance.now() - structuralStart;
  assert.equal(evidence, structural);
  assert.deepEqual(decodeSheetEvidence(evidence, SOURCE), files);
  assert.equal(encodeSheetEvidence(decodeSheetEvidence(evidence, SOURCE), SOURCE), evidence);
  const legacy = materialFiles({ legacy: true });
  assert.equal(legacy.size, 9);
  const historical = encodeSheetEvidence(legacy, SOURCE);
  assert.deepEqual(decodeSheetEvidence(historical, SOURCE), legacy);
  assert.equal(encodeSheetEvidence(decodeSheetEvidence(historical, SOURCE), SOURCE), historical);
  assert.throws(() => encodeSheetCaptureEvidence(legacy, SOURCE), /полный набор файлов/);
  t.diagnostic(
    JSON.stringify({
      inertSingleSample: { checkedMs, structuralMs, decodedPngs: CAPTURE_CASES.length },
      native: 'pending',
      fidelity: 'pending',
    }),
  );
});

test('publication rejects pointwise and absent effects in each theme while structural replay remains available', () => {
  for (const theme of ['Light', 'Dark']) {
    for (const ghost of ['sharp', 'gray', 'linear-0', 'linear-127', 'linear-255', 'sigmoid']) {
      const files = materialFiles({ [theme]: { ghost } });
      assert.deepEqual(decodeSheetEvidence(encodeSheetEvidence(files, SOURCE), SOURCE), files);
      assert.throws(
        () => encodeSheetCaptureEvidence(files, SOURCE),
        new RegExp(`sheet: ${theme} PNG:.*Ghost`),
      );
    }
    for (const body of ['sharp', 'gray', 'colored-copy']) {
      const files = materialFiles({ [theme]: { body } });
      assert.deepEqual(decodeSheetEvidence(encodeSheetEvidence(files, SOURCE), SOURCE), files);
      assert.throws(
        () => encodeSheetCaptureEvidence(files, SOURCE),
        new RegExp(`sheet: ${theme} PNG:.*Body`),
      );
    }
  }
});

test('publication rejects reversed order unblurred stripes and collapsed controls independently in each theme', () => {
  for (const theme of ['Light', 'Dark'])
    for (const order of ['blur-before-paint', 'sharp', 'no-control-gap']) {
      const files = materialFiles({ [theme]: { order } });
      assert.deepEqual(decodeSheetEvidence(encodeSheetEvidence(files, SOURCE), SOURCE), files);
      assert.throws(
        () => encodeSheetCaptureEvidence(files, SOURCE),
        new RegExp(`sheet: ${theme} PNG:.*Body`),
      );
    }
});

test('publication binds each order control to the same scene and paint observations', () => {
  const positive = materialFiles();
  for (const theme of ['Light', 'Dark'])
    for (const variant of ORDER_BACKDROPS) {
      const name = `${theme}-Blur-${variant}.json`;
      for (const mutate of [
        (value) => {
          value.body.y += 0.005;
        },
        (value) => {
          value.backdropWitness.paints.tint.opacity = 0.6;
        },
        (value) => {
          value.backdropWitness.variant = 'A';
        },
      ])
        assert.throws(() => encodeSheetCaptureEvidence(mutateJson(positive, name, mutate), SOURCE));
    }
});

test('rejected pixels remain available only as failed diagnostics and publication still rejects', async () => {
  for (const theme of ['Light', 'Dark']) {
    const files = materialFiles({ [theme]: { ghost: 'sigmoid' } });
    let log = '';
    let writeCompleted = false;
    await assert.rejects(
      publishSheetCaptureEvidence(files, SOURCE, async (value) => {
        await new Promise((resolve) => setImmediate(resolve));
        log += value;
        writeCompleted = true;
      }),
      { code: 'SHEET_PIXEL_REJECTED' },
    );
    assert.equal(writeCompleted, true, 'failure must wait for the diagnostic bytes');
    assert.deepEqual(decodeSheetDiagnosticEvidence(log, SOURCE), files);
    assert.throws(() => decodeSheetEvidence(log, SOURCE));
    assert.ok(!log.includes('LABUI_SHEET_EVIDENCE'));
    const verdict = JSON.parse(log.split('\n')[0].slice('LABUI_SHEET_FAILURE_JSON '.length));
    assert.deepEqual(verdict, {
      source: SOURCE,
      name: `${theme}-Blur-Neighbor`,
      phase: 'material-pixels',
      verdict: 'failed',
      failures: [
        'Ghost has no coherent neighbor response outside changed source footprint',
        'Ghost response does not decay away from changed source footprint',
      ],
    });
  }
  const positive = materialFiles();
  let log = '';
  await publishSheetCaptureEvidence(positive, SOURCE, async (value) => {
    log += value;
  });
  assert.equal(log, encodeSheetCaptureEvidence(positive, SOURCE));
  assert.deepEqual(decodeSheetEvidence(log, SOURCE), positive);
  assert.throws(() => decodeSheetDiagnosticEvidence(log, SOURCE));
});

test('pixel failure cannot publish invalid identity or malformed later PNGs as diagnostics', async () => {
  const rejected = materialFiles({ Light: { ghost: 'sigmoid' } });
  const invalid = [
    mutateJson(rejected, 'identity.json', (identity) => {
      identity.private = 'PRIVATE_CAPTURE_TEXT';
    }),
    ...CAPTURE_CASES.map(({ name }) =>
      new Map(rejected).set(`${name}.png`, materialPng(rasterSources[0], 5)),
    ),
  ];
  for (const files of invalid) {
    let log = '';
    await assert.rejects(
      publishSheetCaptureEvidence(files, SOURCE, async (value) => {
        log += value;
      }),
    );
    assert.equal(log, '', 'an earlier pixel rejection must not bypass later admission');
  }
  for (const files of invalid.slice(1)) {
    const log = encodeSheetEvidence(files, SOURCE).replaceAll(
      'LABUI_SHEET_EVIDENCE',
      'LABUI_SHEET_DIAGNOSTIC_EVIDENCE',
    );
    assert.throws(() => decodeSheetDiagnosticEvidence(log, SOURCE), /неизвестный фильтр 5/);
  }
});

test('Fast true false and null cannot bypass causal Blur PNG assertions', () => {
  for (const areEffectsFast of [true, false, null]) {
    const positive = materialFiles({ areEffectsFast });
    assert.deepEqual(
      decodeSheetEvidence(encodeSheetCaptureEvidence(positive, SOURCE), SOURCE),
      positive,
    );
    for (const theme of ['Light', 'Dark']) {
      const files = materialFiles({ [theme]: { ghost: 'sigmoid' }, areEffectsFast });
      assert.throws(
        () => encodeSheetCaptureEvidence(files, SOURCE),
        new RegExp(`sheet: ${theme} PNG:`),
      );
    }
  }
});

test('publication requires all capture files including order controls and valid pixels in every PNG', () => {
  const positive = materialFiles();
  for (const file of positive.keys()) {
    const files = new Map(positive);
    files.delete(file);
    assert.throws(() => encodeSheetCaptureEvidence(files, SOURCE), /полный набор файлов/);
  }
  const missingNeighbors = new Map(positive);
  for (const theme of ['Light', 'Dark'])
    for (const suffix of ['json', 'png'])
      missingNeighbors.delete(`${theme}-Blur-Neighbor.${suffix}`);
  assert.equal(missingNeighbors.size, positive.size - 4);
  assert.throws(() => encodeSheetCaptureEvidence(missingNeighbors, SOURCE), /полный набор файлов/);
  for (const { name } of CAPTURE_CASES) {
    const malformedJson = new Map(positive).set(`${name}.json`, Buffer.from('{'));
    assert.throws(() => encodeSheetCaptureEvidence(malformedJson, SOURCE));
    const malformedPng = new Map(positive).set(`${name}.png`, Buffer.from('invalid PNG'));
    assert.throws(() => encodeSheetCaptureEvidence(malformedPng, SOURCE));
    const invalidPixels = new Map(positive).set(`${name}.png`, materialPng(rasterSources[0], 5));
    assert.deepEqual(
      decodeSheetEvidence(encodeSheetEvidence(invalidPixels, SOURCE), SOURCE),
      invalidPixels,
    );
    assert.throws(() => encodeSheetCaptureEvidence(invalidPixels, SOURCE), /неизвестный фильтр 5/);
  }
});

test('publication binds fixture hashes actual image fit bitmap dimensions and paints in each pair', () => {
  const positive = materialFiles();
  for (const mutate of [
    (identity) => {
      identity.schema = 'unknown';
    },
    (identity) => {
      identity.backdropFixtureSha256 = 'c'.repeat(64);
    },
    (identity) => {
      identity.backdropFixtureSha256 = undefined;
    },
  ])
    assert.throws(() =>
      encodeSheetCaptureEvidence(mutateJson(positive, 'identity.json', mutate), SOURCE),
    );
  for (const theme of ['Light', 'Dark']) {
    const name = `${theme}-Blur-Neighbor.json`;
    for (const mutate of [
      (value) => {
        value.backdropWitness = undefined;
      },
      (value) => {
        value.backdropWitness.variant = 'A';
      },
      (value) => {
        value.backdropWitness.fixtureSha256 = 'c'.repeat(64);
      },
      (value) => {
        value.backdropWitness.assetSha256 = BACKDROP_FIXTURE.assets.A.sha256;
      },
      (value) => {
        value.backdropWitness.sourcePixels.width--;
      },
      (value) => {
        value.backdropWitness.image.source = 'ms-appx:///Assets/SheetBackdrop.png';
      },
      (value) => {
        value.backdropWitness.image.bitmapPixels.width = 0;
      },
      (value) => {
        value.backdropWitness.image.bitmapPixels.height = 0;
      },
      (value) => {
        value.backdropWitness.image.bitmapPixels.width--;
      },
      (value) => {
        value.backdropWitness.image.bounds.height = 840;
        value.backdropWitness.fit.scale = Math.max(375 / 1733, 840 / 4096);
      },
      (value) => {
        value.backdropWitness.fit.scale += 0.001;
      },
      (value) => {
        value.backdropWitness.fit.offsetY = -37.16;
      },
      (value) => {
        value.backdropWitness.image.stretch = 'Uniform';
      },
      (value) => {
        value.backdropWitness.image.horizontalAlignment = 'Center';
      },
      (value) => {
        value.backdropWitness.paints.ghost.rgba[0]++;
      },
      (value) => {
        value.backdropWitness.paints.tint.opacity = 0.6;
      },
      (value) => {
        value.backdropWitness.paints.noise.rgba = [1, 2, 3];
      },
      (value) => {
        value.backdropWitness.paints.solid.rgba[3] = 256;
      },
      (value) => {
        value.backdropWitness.privateText = 'PRIVATE_CAPTURE_TEXT';
      },
      (value) => {
        value.requestedState = 'Full';
      },
      (value) => {
        value.geometryScale = 2;
      },
      (value) => {
        value.contentWitness = {};
      },
    ])
      assert.throws(() => encodeSheetCaptureEvidence(mutateJson(positive, name, mutate), SOURCE));
  }
});

test('material equality and capability failures remain fatal while legitimate Solid facts remain readable', () => {
  const positive = materialFiles();
  for (const { name, material } of CAPTURE_CASES) {
    if (material !== 'Blur') continue;
    for (const mutate of [
      (value) => {
        value.effectiveMaterial = 'Solid';
      },
      (value) => {
        value.materialCapabilities = undefined;
      },
      (value) => {
        value.materialCapabilities.areEffectsSupported = false;
      },
      (value) => {
        value.materialCapabilities.advancedEffectsEnabled = false;
      },
    ])
      assert.throws(
        () => encodeSheetCaptureEvidence(mutateJson(positive, `${name}.json`, mutate), SOURCE),
        (error) => error.sheetPhase === 'capability',
      );
  }
  let fallback = positive;
  for (const theme of ['Light', 'Dark'])
    fallback = mutateJson(fallback, `${theme}-Solid.json`, (value) => {
      value.materialReason = 'EffectsUnsupported';
      value.materialCapabilities = {
        advancedEffectsEnabled: false,
        areEffectsSupported: false,
        areEffectsFast: false,
      };
    });
  assert.deepEqual(decodeSheetEvidence(encodeSheetEvidence(fallback, SOURCE), SOURCE), fallback);
  assert.deepEqual(
    decodeSheetEvidence(encodeSheetCaptureEvidence(fallback, SOURCE), SOURCE),
    fallback,
  );
});

async function backdropSources() {
  return Promise.all([
    readFile(new URL('../../../examples/windows/SheetPage.xaml.cs', import.meta.url), 'utf8'),
    readFile(new URL('../../../examples/windows/SheetPage.xaml', import.meta.url), 'utf8'),
    readFile(new URL('../../../examples/windows/SheetBackdropProbe.cs', import.meta.url), 'utf8'),
    readFile(new URL('../Rendering/SheetLayers.cs', import.meta.url), 'utf8'),
    readFile(new URL('./sheet.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../../../examples/windows/Buttons.csproj', import.meta.url), 'utf8'),
  ]);
}
function assertBackdropSource(page, xaml, probe, renderer, protocol, project) {
  const sourcePosition = page.indexOf(
    'BackdropSource = backdropProbe?.Source ?? new BitmapImage(new Uri("ms-appx:///Assets/SheetBackdrop.png"));',
  );
  assert.ok(
    sourcePosition >= 0 && sourcePosition < page.indexOf('InitializeComponent();'),
    'select original or neighbor source before initial XAML load',
  );
  assert.match(
    page,
    /backdropProbe = SheetBackdropProbe\.Create\(arguments, observationPath is not null\);/,
  );
  assert.match(xaml, /Source="\{x:Bind BackdropSource\}" Stretch="UniformToFill" \/>/);
  assert.match(probe, /if \(!observing\) throw new InvalidOperationException/);
  assert.match(
    probe,
    /image\.TransformToVisual\(page\)\.TransformBounds\(new Rect\(0, 0, image\.ActualWidth, image\.ActualHeight\)\)/,
  );
  assert.match(probe, /width = bitmap\.PixelWidth, height = bitmap\.PixelHeight/);
  assert.match(
    probe,
    /scale = Math\.Max\(image\.ActualWidth \/ fixture\.sourcePixels\.width,\s*image\.ActualHeight \/ fixture\.sourcePixels\.height\)/,
  );
  assert.match(probe, /offsetX = bounds\.X,\s*offsetY = bounds\.Y/);
  for (const name of BACKDROP_PAINTS) {
    const property = name[0].toUpperCase() + name.slice(1);
    assert.match(probe, new RegExp(`${name} = Paint\\(layers\\.${property}\\)`));
  }
  assert.doesNotMatch(
    page + probe,
    /layers\.(?:Tint|Blend|Ghost|Border|Noise|ShadowInk|Solid)\s*=|\.Color\s*=/,
  );
  assert.match(
    page,
    /if \(backdropProbe is not null && error is null\)\s*snapshot\["backdropWitness"\]/,
  );
  const noise = renderer.slice(
    renderer.indexOf('private void DrawNoise('),
    renderer.indexOf('private sealed class SurfaceStages'),
  );
  assert.match(
    noise,
    /uint state = 0x9E3779B9;\s*for \(var offset = 0; offset < pixels\.Length; offset \+= 4\)\s*\{\s*state \^= state << 13;\s*state \^= state >> 17;\s*state \^= state << 5;/,
  );
  assert.match(
    noise,
    /var alpha = \(byte\)Math\.Round\(\(state & 255\) \* paint\.Opacity \* paint\.Color\.A \/ 255\);/,
  );
  assert.doesNotMatch(
    noise,
    /Random|DateTime|Environment|BitmapImage|UriSource|PixelWidth|PixelHeight/,
  );
  assert.match(
    project,
    /Content Include="Assets\/SheetBackdropWitness\.json;Assets\/SheetBackdropNeighbor\.png;Assets\/SheetBackdropOrder\*\.png"\s*CopyToOutputDirectory="PreserveNewest"/,
  );
  assert.match(
    protocol,
    /entry\.backdrop \? \[`--sheet-backdrop-witness=\$\{entry\.backdrop\}`\] : \[\]/,
  );
  assert.match(protocol, /for \(const entry of content \? CONTENT_CASES : CAPTURE_CASES\)/);
  assert.match(protocol, /\(content \? CONTENT_FILES : CAPTURE_FILES\)\.map/);
  assert.match(protocol, /operation === 'decode-content' \? 32 : 48/);
}

test('example fixture changes only initial Source and reads actual image and unchanged layer paints', async () => {
  const files = await backdropSources();
  assertBackdropSource(...files);
  const lateSource = [...files];
  lateSource[0] = lateSource[0]
    .replace('InitializeComponent();', '')
    .replace(
      'BackdropSource = backdropProbe?.Source',
      'InitializeComponent();\n        BackdropSource = backdropProbe?.Source',
    );
  assert.throws(() => assertBackdropSource(...lateSource), /before initial XAML load/);
  const fakePaint = [...files];
  fakePaint[2] = fakePaint[2].replace(
    'ghost = Paint(layers.Ghost)',
    'ghost = Paint(new SolidColorBrush())',
  );
  assert.throws(() => assertBackdropSource(...fakePaint));
  const freshNoise = [...files];
  freshNoise[3] = freshNoise[3].replace(
    'uint state = 0x9E3779B9;',
    'uint state = (uint)DateTime.UtcNow.Ticks;',
  );
  assert.throws(() => assertBackdropSource(...freshNoise));
});

test('material capture gathers neighbor and order cases before the production PNG publication gate', async () => {
  assert.deepEqual(
    CASES,
    ['Light', 'Dark'].flatMap((theme) =>
      ['Blur', 'Solid'].map((material) => ({ name: `${theme}-${material}`, theme, material })),
    ),
  );
  assert.deepEqual(CAPTURE_CASES, [
    ...CASES.map((entry) => ({ ...entry, backdrop: 'A' })),
    ...['Light', 'Dark'].map((theme) => ({
      name: `${theme}-Blur-Neighbor`,
      theme,
      material: 'Blur',
      backdrop: 'B',
    })),
    ...['Light', 'Dark'].flatMap((theme) =>
      ORDER_BACKDROPS.map((backdrop) => ({
        name: `${theme}-Blur-${backdrop}`,
        theme,
        material: 'Blur',
        backdrop,
      })),
    ),
  ]);
  const source = await readFile(new URL('./sheet.mjs', import.meta.url), 'utf8');
  const capture = source.slice(
    source.indexOf('async function capture('),
    source.indexOf('async function main('),
  );
  const assertPublication = (candidate) => {
    assert.match(candidate, /const files = new Map\(\s*await Promise\.all\(/);
    assert.match(
      candidate,
      /if \(content\) await writeStdout\(encode\(files, sourceSha, true\)\);\s*else await publishSheetCaptureEvidence\(files, sourceSha\);/,
    );
    assert.ok(
      candidate.indexOf('const files = new Map(') < candidate.indexOf('await writeStdout('),
    );
  };
  assertPublication(capture);
  assert.throws(() =>
    assertPublication(
      capture.replace(
        'publishSheetCaptureEvidence(files, sourceSha)',
        'writeStdout(encode(files, sourceSha))',
      ),
    ),
  );
});
