/*
 * Генератор ассета acrylic-шума (ADR-0004 Решение 1 §4, наследует ADR-0002 §1).
 *
 * Шум ~2% — мелкозернистая текстура, снимающая бандинг градиентов ПОД блюром;
 * именно она делает акрил «чище обычного фонового блюра». ADR требует ассет
 * ОДНОЙ генерации (data-URI PNG), НЕ рантайм-фильтр (feTurbulence пересчитывался
 * бы каждый кадр; декодированный PNG браузер растеризует один раз и тайлит).
 *
 * Детерминизм = провенанс: сид, размер тайла и запечённая альфа зафиксированы
 * ниже, PNG кодируется чистым node:zlib (без зависимостей и без бинаря в git).
 * `check-generated` перегенерирует и сверяет инлайн в material.css — протухший
 * ассет краснит CI, а не тихо дрейфит.
 *
 * Провенанс величин:
 *   NOISE_ALPHA = 5  → 5/255 ≈ 1.96% — реализация «~2%» из ADR-0002 §1 (запечена
 *                      в альфу пикселей; слой красится на полной непрозрачности).
 *   NOISE_SIZE  = 48 → DECLARED размер тайла: достаточно мелко для зерна, при 2%
 *                      непрозрачности повтор тайла перцептивно невидим; тайлится
 *                      на интринзик-размере (`background-size: auto`) — без magic-px.
 *   NOISE_SEED       → DECLARED константа воспроизводимости (любое фикс-значение;
 *                      важна повторяемость, не конкретика).
 *   gray ∈ [0,255]   → равномерный дизер яркости: тёмные зёрна видны на светлом
 *                      фоне, светлые — на тёмном (симметрично гасит бандинг).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

export const NOISE_SIZE = 48;
export const NOISE_ALPHA = 5;
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

/** Один PNG-чанк: length(4) + type(4) + data + crc(4 над type+data). */
function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new Uint8Array([...type].map((ch) => ch.charCodeAt(0)));
  const body = new Uint8Array(typeBytes.length + data.length);
  body.set(typeBytes, 0);
  body.set(data, typeBytes.length);
  return new Uint8Array([...u32be(data.length), ...body, ...u32be(crc32(body))]);
}

/**
 * Детерминированный PNG-шум `NOISE_SIZE × NOISE_SIZE`, цветовой тип 4
 * (grayscale + alpha, 8 бит): gray — равномерный шум, alpha — константа
 * `NOISE_ALPHA`. Возвращает готовые байты PNG.
 */
export function acrylicNoisePng(): Uint8Array {
  const rnd = mulberry32(NOISE_SEED);
  const bpp = 2; // gray + alpha
  const stride = NOISE_SIZE * bpp;
  // Отфильтрованные строки: каждая начинается байтом фильтра 0 (none).
  const raw = new Uint8Array((stride + 1) * NOISE_SIZE);
  for (let y = 0; y < NOISE_SIZE; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < NOISE_SIZE; x++) {
      const i = rowStart + 1 + x * bpp;
      raw[i] = Math.floor(rnd() * 256) & 0xff; // gray
      raw[i + 1] = NOISE_ALPHA; // baked ~2% alpha
    }
  }
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = new Uint8Array([
    ...u32be(NOISE_SIZE), // width
    ...u32be(NOISE_SIZE), // height
    8, // bit depth
    4, // colour type: grayscale + alpha
    0, // compression
    0, // filter
    0, // interlace
  ]);
  const idat = new Uint8Array(deflateSync(raw, { level: 9 }));
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

// ── Инлайн в material.css между сентинелами (идемпотентно) ───────────────────
const START =
  '/* >>> ACRYLIC-NOISE:GENERATED (scripts/build-acrylic-noise.ts) — не править руками */';
const END = '/* <<< ACRYLIC-NOISE:GENERATED */';

/** Заменяет тело сентинел-региона в исходнике material.css на свежий data-URI. */
export function inlineAcrylicNoise(css: string): string {
  const startIdx = css.indexOf(START);
  const endIdx = css.indexOf(END);
  if (startIdx < 0 || endIdx < 0 || endIdx < startIdx) {
    throw new Error(
      'material.css: сентинелы ACRYLIC-NOISE не найдены — регион для инлайна отсутствует',
    );
  }
  const before = css.slice(0, startIdx + START.length);
  const after = css.slice(endIdx);
  return `${before}\n  --_acrylic-noise: ${acrylicNoiseDataUri()};\n  ${after}`;
}

/** Абсолютный путь к material.css рядом с этим скриптом. */
export function materialCssPath(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'material.css');
}

// Запуск как скрипт (build / check-generated): перезаписать material.css инлайном.
// Кросс-платформенная детекция «запущен напрямую» (Windows `file:///C:` ≠ `file://`).
const invokedPath = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : '';
const selfPath = fileURLToPath(import.meta.url).toLowerCase();
if (invokedPath && invokedPath === selfPath) {
  const cssPath = materialCssPath();
  writeFileSync(cssPath, inlineAcrylicNoise(readFileSync(cssPath, 'utf8')));
}
