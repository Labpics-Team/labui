import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
/** Bake the author's monotone noise once. The source profile supplies colour,
 * maximum opacity, density and grain scale. Seed/tile geometry are renderer choices. */
import { materialProfile } from '../src/profile';

export const NOISE_SIZE = 48;
export const NOISE_ALPHA = Math.round(255 * materialProfile.noise.opacity);
export const NOISE_SEED = 0x6c_61_62_75; // 'labu' — фикс сид, только ради повторяемости

/** mulberry32 — крошечный детерминированный PRNG (32-бит), достаточный для зерна. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d_2b_79_f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** CRC-32 (IEEE, полином PNG) — табличный, для контрольных сумм чанков. */
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xed_b8_83_20 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xff_ff_ff_ff;
  // Индекс всегда 0..255 (маска & 0xff), таблица длиной 256 — `?? 0` только ради
  // noUncheckedIndexedAccess, в рантайме ветка никогда не срабатывает.
  for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xff_ff_ff_ff) >>> 0;
}

function u32be(value: number): Uint8Array {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]);
}

/** Adler-32 (RFC 1950) — контрольная сумма zlib-обёртки. */
function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65_521;
    b = (b + a) % 65_521;
  }
  return ((b << 16) | a) >>> 0;
}

/**
 * zlib-поток из stored-блоков (BTYPE=00, без сжатия): header 0x78 0x01,
 * затем блоки LEN/NLEN ≤ 65535 байт, затем adler32 сырых данных. Байты
 * зависят ТОЛЬКО от входа — никакой версии zlib в уравнении.
 */
function zlibStored(raw: Uint8Array): Uint8Array {
  const out: number[] = [0x78, 0x01];
  for (let off = 0; off < raw.length; off += 65_535) {
    const len = Math.min(65_535, raw.length - off);
    const final = off + len >= raw.length ? 1 : 0;
    out.push(final, len & 0xff, (len >>> 8) & 0xff, ~len & 0xff, (~len >>> 8) & 0xff);
    for (const byte of raw.subarray(off, off + len)) out.push(byte);
  }
  out.push(...u32be(adler32(raw)));
  return new Uint8Array(out);
}

/** Один PNG-чанк: length(4) + type(4) + data + crc(4 над type+data). */
function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new Uint8Array([...type].map((ch) => ch.charCodeAt(0)));
  const body = new Uint8Array(typeBytes.length + data.length);
  body.set(typeBytes, 0);
  body.set(data, typeBytes.length);
  return new Uint8Array([...u32be(data.length), ...body, ...u32be(crc32(body))]);
}

/** A deterministic RGBA tile: author RGB, variable alpha up to NOISE_ALPHA. */
export function acrylicNoisePng(opacity = materialProfile.noise.opacity): Uint8Array {
  const rnd = mulberry32(NOISE_SEED);
  const alpha = Math.round(255 * opacity);
  const bpp = 4; // author RGB + varying coverage
  const stride = NOISE_SIZE * bpp;
  // Отфильтрованные строки: каждая начинается байтом фильтра 0 (none).
  const raw = new Uint8Array((stride + 1) * NOISE_SIZE);
  for (let y = 0; y < NOISE_SIZE; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < NOISE_SIZE; x++) {
      const i = rowStart + 1 + x * bpp;
      raw[i] = materialProfile.noise.color[0] ?? 0;
      raw[i + 1] = materialProfile.noise.color[1] ?? 0;
      raw[i + 2] = materialProfile.noise.color[2] ?? 0;
      raw[i + 3] = rnd() <= materialProfile.noise.density ? Math.round(rnd() * alpha) : 0;
    }
  }
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = new Uint8Array([
    ...u32be(NOISE_SIZE), // width
    ...u32be(NOISE_SIZE), // height
    8, // bit depth
    6, // colour type: RGBA
    0, // compression
    0, // filter
    0, // interlace
  ]);
  const idat = zlibStored(raw);
  return new Uint8Array([
    ...signature,
    ...chunk('IHDR', ihdr),
    ...chunk('IDAT', idat),
    ...chunk('IEND', new Uint8Array(0)),
  ]);
}

/** Тот же PNG как `url("data:image/png;base64,…")` для CSS-переменной. */
export function acrylicNoiseDataUri(): string {
  const base64 = Buffer.from(acrylicNoisePng()).toString('base64');
  return `url("data:image/png;base64,${base64}")`;
}

// ── Инлайн в acrylic.css между сентинелами (идемпотентно) ────────────────────
const START =
  '/* >>> ACRYLIC-NOISE:GENERATED (scripts/build-acrylic-noise.ts) — не править руками */';
const END = '/* <<< ACRYLIC-NOISE:GENERATED */';

/** One shared asset and its CSS grain scale, both consumed by the renderer. */
export function acrylicNoiseCssBlock(): string {
  return [
    '.lab-material {',
    `  --_acrylic-noise: ${acrylicNoiseDataUri()};`,
    `  --_acrylic-noise-size: ${Number((NOISE_SIZE * materialProfile.noise.size).toFixed(6))}px;`,
    '}',
  ].join('\n');
}

/** Заменяет тело сентинел-региона в src/materials/acrylic.css на свежий блок. */
export function inlineAcrylicNoise(css: string): string {
  const startIdx = css.indexOf(START);
  const endIdx = css.indexOf(END);
  if (startIdx < 0 || endIdx < 0 || endIdx < startIdx) {
    throw new Error(
      'acrylic.css: сентинелы ACRYLIC-NOISE не найдены — регион для инлайна отсутствует',
    );
  }
  const before = css.slice(0, startIdx + START.length);
  const after = css.slice(endIdx);
  return `${before}\n${acrylicNoiseCssBlock()}\n${after}`;
}

/** Абсолютный путь к файлу-материалу acrylic.css рядом с этим скриптом. */
export function materialCssPath(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'materials', 'acrylic.css');
}

// Запуск как скрипт (build / check-generated): перезаписать acrylic.css инлайном
// и прогнать РЕПО-ФОРМАТТЕРОМ — иначе biome пере-переносит длинный image-set и
// «git diff --exit-code» в check-generated спорил бы с форматом, а не с данными.
// Формат-канон принадлежит biome; генератор владеет только СОДЕРЖИМЫМ.
// Кросс-платформенная детекция «запущен напрямую» (Windows `file:///C:` ≠ `file://`).
const invokedPath = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : '';
const selfPath = fileURLToPath(import.meta.url).toLowerCase();
if (invokedPath && invokedPath === selfPath) {
  const cssPath = materialCssPath();
  writeFileSync(cssPath, inlineAcrylicNoise(readFileSync(cssPath, 'utf8')));
  execSync(`pnpm exec biome format --write "${cssPath}"`, {
    cwd: resolve(dirname(fileURLToPath(import.meta.url)), '..'),
    stdio: 'ignore',
  });
}
