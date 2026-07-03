// Тонкий паспорт (BL-007). labui.config.thin.json опускает массивы
// roles/aliases — движок раскрывает их пресетом «labui». Файл держит ТРИ гейта:
//
//   A) СТРУКТУРА (чистый JSON, гоняется на ЛЮБОМ движке, без skip): общие
//      секции тонкого === полного; тонкий несёт preset и опускает словарь.
//      Ловит дрейф значений тонкого↔полного СЕЙЧАС, на опубликованном 0.5.0 —
//      где движок отвергает тонкий по структуре (missing field `roles`) РАНЬШЕ
//      валидации значений, потому дрейф иначе был бы невидим до релиза 0.6.
//   B) СТРАЖ ФИЧЕ-ДЕТЕКТА (Class D — тест теста): isPresetUnsupported не должна
//      маскировать иную ошибку под «нет пресетов».
//   C) ТОЖДЕСТВО ЖИВЬЁМ (skip-гард, требует пресет-способного движка ≥0.6):
//      loadConfig(тонкий).fingerprint === loadConfig(полный).fingerprint и
//      generateContract(тонкий) === generateContract(полный), байт-в-байт — оба
//      ОТНОСИТЕЛЬНО, без хардкода отпечатка. На 0.5.0 честно пропущено (причина
//      в имени теста), авто-включается на 0.6.0 по фиче-детекту.
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import {
  FULL_PASSPORT_PATH,
  THIN_PASSPORT_PATH,
  createLabuiEngine,
  engineSupportsPreset,
  isPresetUnsupported,
} from '../engine.mjs';
import { generateContract } from '../generate-contract.mjs';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const sharedSections = (c) => ({
  brand: c.brand,
  neutral: c.neutral,
  palette: c.palette,
  sentiments: c.sentiments,
  themes: c.themes,
});

// --- A) Структура: детерминированно, без движка, на любой версии ------------
describe('структура тонкого паспорта (без движка, любой версии)', () => {
  it('общие секции тонкого === полного (brand/neutral/palette/sentiments/themes)', async () => {
    const [thin, full] = await Promise.all([
      readJson(THIN_PASSPORT_PATH),
      readJson(FULL_PASSPORT_PATH),
    ]);
    expect(sharedSections(thin)).toEqual(sharedSections(full));
  });

  it('тонкий несёт preset:"labui" и опускает roles/aliases; полный — наоборот', async () => {
    const [thin, full] = await Promise.all([
      readJson(THIN_PASSPORT_PATH),
      readJson(FULL_PASSPORT_PATH),
    ]);
    expect(thin.preset).toBe('labui');
    expect('roles' in thin).toBe(false);
    expect('aliases' in thin).toBe(false);
    expect('preset' in full).toBe(false);
    expect(Array.isArray(full.roles)).toBe(true);
    expect(Array.isArray(full.aliases)).toBe(true);
  });
});

// --- B) Страж фиче-детекта (Class D) ----------------------------------------
describe('isPresetUnsupported — страж фиче-детекта (Class D)', () => {
  it('реальная ошибка пре-пресетного 0.5.0 → true', () => {
    const err = new Error(
      'invalid_config: invalid config: missing field `roles` at line 168 column 1',
    );
    expect(isPresetUnsupported(err)).toBe(true);
  });

  it('иное опущенное поле (brand) → false — не маскируем сломанный движок', () => {
    const err = new Error('invalid_config: invalid config: missing field `brand`');
    expect(isPresetUnsupported(err)).toBe(false);
  });

  it('ошибка без invalid_config (парсинг JSON) → false', () => {
    expect(isPresetUnsupported(new Error('failed to parse json at line 1'))).toBe(false);
  });

  it('строковый примитив-ошибка разбирается без броска → false', () => {
    expect(isPresetUnsupported('boom')).toBe(false);
  });
});

// --- C) Тождество живьём (skip-гард на пресет-способный движок ≥0.6) ---------
const presetSupported = await engineSupportsPreset();
const skipNote = presetSupported
  ? ''
  : ' [пропуск: @labpics/colors < 0.6 без пресетов — включится на 0.6.0]';

describe('тождество тонкого и полного паспорта (BL-007)', () => {
  it.skipIf(!presetSupported)(
    `отпечаток тонкого === отпечаток полного (оба живьём)${skipNote}`,
    async () => {
      const thin = await createLabuiEngine(THIN_PASSPORT_PATH);
      const full = await createLabuiEngine(FULL_PASSPORT_PATH);
      expect(thin.fingerprint).toBe(full.fingerprint);
    },
  );

  it.skipIf(!presetSupported)(
    `contract.css из тонкого === из полного, байт-в-байт${skipNote}`,
    async () => {
      const fromThin = await generateContract(THIN_PASSPORT_PATH);
      const fromFull = await generateContract(FULL_PASSPORT_PATH);
      expect(fromThin).toBe(fromFull);
    },
  );
});
