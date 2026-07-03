// Гейт регенерационной дисциплины: contract.css на диске обязан быть
// байт-в-байт тем, что генерирует движок СЕЙЧАС (опубликованный пакет +
// паспорт + Figma-якорь). Дрейф любого из трёх источников без регенерации —
// красный тест, а не тихое расхождение файла с движком.
//
// Независимость истины не теряется: золотая сверка (golden-parity) меряет
// движок против ЗАМОРОЖЕННОГО якоря; здесь меряется только дисциплина
// артефакта.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { FULL_PASSPORT_PATH, THIN_PASSPORT_PATH, engineSupportsPreset } from '../engine.mjs';
import { generateContract } from '../generate-contract.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const contractPath = join(here, '..', '..', 'colors-stub', 'contract.css');
const referencePath = join(here, '..', '..', 'colors-stub', 'figma-reference.css');

describe('сгенерированный контракт', () => {
  it('файл на диске байт-в-байт равен свежей генерации', async () => {
    const disk = (await readFile(contractPath, 'utf8')).replace(/\r\n/g, '\n');
    // Генерируем из ТОНКОГО паспорта, когда движок понимает пресеты, иначе из
    // полного эталона (вывод байт-в-байт тот же — тождество доказано отдельно).
    // Так гейт дисциплины остаётся зелёным и содержательным и на 0.5.0, и на ≥0.6.
    const passportPath = (await engineSupportsPreset()) ? THIN_PASSPORT_PATH : FULL_PASSPORT_PATH;
    const fresh = (await generateContract(passportPath)).replace(/\r\n/g, '\n');
    expect(disk).toBe(fresh);
  });

  it('покрытие якоря полное: ни одна переменная не потеряна', async () => {
    const names = (css) => new Set([...css.matchAll(/(--lab-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    const anchor = names(await readFile(referencePath, 'utf8'));
    const contract = names(await readFile(contractPath, 'utf8'));
    const lost = [...anchor].filter((n) => !contract.has(n));
    expect(lost, 'переменные якоря, потерянные генерацией').toEqual([]);
  });
});
