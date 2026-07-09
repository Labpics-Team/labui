import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  NOISE_ALPHA,
  NOISE_SIZE,
  acrylicNoiseDataUri,
  acrylicNoisePng,
} from '../scripts/build-acrylic-noise';

/*
 * Ассет acrylic-шума (ADR-0004 Решение 1 §4). Тестируем САМ АРТЕФАКТ, не только
 * генератор (stale export расходится с исправленным генератором — класс из
 * icons-test-artifact). Три вещи:
 *   1. PNG валиден и его геометрия = объявленный тайл (провенанс не разъехался).
 *   2. Генерация детерминирована (тот же байт → воспроизводимость / check-generated).
 *   3. Инлайн в material.css === выход генератора (ассет не протух в CSS).
 *
 * Классы: А (unit-декод) + Б (golden/inline-seal — характеризует ассет и ловит дрейф).
 */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Читает big-endian u32 из байтов. */
function u32(bytes: Uint8Array, at: number): number {
  return (
    (((bytes[at] ?? 0) << 24) |
      ((bytes[at + 1] ?? 0) << 16) |
      ((bytes[at + 2] ?? 0) << 8) |
      (bytes[at + 3] ?? 0)) >>>
    0
  );
}

/** Извлекает IHDR (сразу после сигнатуры + длины/типа первого чанка). */
function readIhdr(png: Uint8Array) {
  // 8 сигнатура + 4 длина + 4 тип 'IHDR' → данные IHDR на смещении 16.
  const at = 16;
  return {
    width: u32(png, at),
    height: u32(png, at + 4),
    bitDepth: png[at + 8],
    colourType: png[at + 9],
  };
}

/** Склеивает ВСЕ IDAT-чанки, инфлейтит и возвращает отфильтрованные строки.
 * PNG штатно допускает несколько IDAT (поток zlib разрезан по чанкам) — читать
 * только первый значило бы молча декодировать часть строк, если будущий энкодер
 * начнёт резать поток. */
function readIdat(png: Uint8Array): Uint8Array {
  // Прошагать чанки от смещения 8, собрать все IDAT по порядку.
  const parts: Uint8Array[] = [];
  let total = 0;
  let i = 8;
  while (i < png.length) {
    const len = u32(png, i);
    const type = String.fromCharCode(
      png[i + 4] ?? 0,
      png[i + 5] ?? 0,
      png[i + 6] ?? 0,
      png[i + 7] ?? 0,
    );
    if (type === 'IDAT') {
      const part = png.slice(i + 8, i + 8 + len);
      parts.push(part);
      total += part.length;
    }
    i += 12 + len; // length(4)+type(4)+data(len)+crc(4)
  }
  if (parts.length === 0) throw new Error('IDAT chunk not found');
  const joined = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    joined.set(part, at);
    at += part.length;
  }
  return new Uint8Array(inflateSync(joined));
}

describe('acrylic-noise PNG — валидный, детерминированный, объявленной геометрии', () => {
  const png = acrylicNoisePng();

  it('начинается сигнатурой PNG', () => {
    expect([...png.slice(0, 8)]).toEqual(PNG_SIGNATURE);
  });

  it('IHDR: тайл NOISE_SIZE², 8 бит, цветовой тип 4 (grayscale+alpha)', () => {
    const ihdr = readIhdr(png);
    expect(ihdr.width).toBe(NOISE_SIZE);
    expect(ihdr.height).toBe(NOISE_SIZE);
    expect(ihdr.bitDepth).toBe(8);
    expect(ihdr.colourType).toBe(4);
  });

  it('детерминирован — два прогона байт-в-байт равны', () => {
    expect([...acrylicNoisePng()]).toEqual([...acrylicNoisePng()]);
  });

  it('~2% запечены в АЛЬФУ (все alpha = NOISE_ALPHA), а gray реально шумит', () => {
    const rows = readIdat(png);
    const stride = NOISE_SIZE * 2 + 1; // filter-byte + (gray,alpha)×width
    const grays = new Set<number>();
    for (let y = 0; y < NOISE_SIZE; y++) {
      const rowStart = y * stride;
      expect(rows[rowStart]).toBe(0); // filter: none
      for (let x = 0; x < NOISE_SIZE; x++) {
        const i = rowStart + 1 + x * 2;
        grays.add(rows[i] ?? -1);
        expect(rows[i + 1]).toBe(NOISE_ALPHA); // альфа — константа ~2%
      }
    }
    // Настоящий шум: много различных уровней серого (не плоская заливка).
    expect(grays.size).toBeGreaterThan(64);
  });

  it('NOISE_ALPHA ≈ 2% (провенанс ADR-0002 §1: 5/255 ≈ 1.96%)', () => {
    expect(NOISE_ALPHA / 255).toBeGreaterThan(0.015);
    expect(NOISE_ALPHA / 255).toBeLessThan(0.025);
  });
});

describe('inline-seal — acrylic.css несёт РОВНО выход генератора (check-generated в репозитории)', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const css = readFileSync(resolve(here, '..', 'src', 'materials', 'acrylic.css'), 'utf8');

  it('сентинел-регион содержит именно текущий data-URI (ассет не протух)', () => {
    expect(css).toContain(`--_acrylic-noise: ${acrylicNoiseDataUri()};`);
  });

  it('в CSS нет забытой заглушки `--_acrylic-noise: none` (генератор отработал)', () => {
    expect(css).not.toContain('--_acrylic-noise: none');
  });

  it('image-set: ТОТ ЖЕ ассет на 1x/2x/3x под @supports-гейтом (зерно в 1 физический пиксель)', () => {
    const uri = acrylicNoiseDataUri();
    // Одна генерация — три плотности: на DPR≥2 интринзик-тайл 24/16 CSS-px,
    // зерно per-device-pixel (как у Fluent), новых ассетов ноль.
    expect(css).toContain(`image-set(${uri} 1x, ${uri} 2x, ${uri} 3x)`);
    // @supports обязателен: невалидное значение уронило бы ВСЮ multi-bg
    // декларацию (включая тинт) на браузерах без image-set.
    expect(css).toContain(`@supports (background-image: image-set(${uri} 1x))`);
    // url()-фолбэк объявлен ДО image-set-оверрайда (каскад: поздний выигрывает).
    expect(css.indexOf(`--_acrylic-noise: ${uri};`)).toBeLessThan(css.indexOf('image-set('));
  });
});
