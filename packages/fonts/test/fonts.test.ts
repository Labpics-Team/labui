import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Пин SHA-256 = upstream Geist v1.7.2 (raw vercel/geist-font). Машинный пин
 * провенанса: магии wOF2 мало — подменённый, но валидный woff2 её бы прошёл.
 * Хэш обязан совпасть и с апстримом, и с прозой PROVENANCE.md.
 */
const EXPECTED_SHA256: Record<string, string> = {
  'fonts/Geist-Variable.woff2': '2ffebe993e969069a9789d15164b7715d42491b5835516c5e3b935d5f81b05f1',
  'fonts/GeistMono-Variable.woff2':
    'afaacc4c5fbba89d2ebf7a02dc4070208540874592a5504d57175782fe893101',
};

/**
 * Тестируем АРТЕФАКТ, а не намерение: @font-face должен ссылаться на файлы,
 * которые реально лежат на диске и являются валидным WOFF2 нужной вариативной
 * оси. Класс А (контракт CSS↔файлы) + Класс Б (бинарник не подменён мусором).
 * RED-proof: удалить один woff2 или перепутать имя в src — падает «файл есть».
 */
const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(pkgRoot, 'fonts.css'), 'utf8');

const FACES = [
  { family: 'Geist', file: 'fonts/Geist-Variable.woff2' },
  { family: 'Geist Mono', file: 'fonts/GeistMono-Variable.woff2' },
];

describe('@labpics/fonts — @font-face и бинарники', () => {
  it('регистрирует оба семейства Geist / Geist Mono', () => {
    for (const f of FACES) {
      expect(css).toContain(`font-family: "${f.family}";`);
    }
    // Ровно два @font-face-ПРАВИЛА (с `{`, не упоминания в комментарии) —
    // ни лишних, ни недостающих начертаний.
    expect(css.match(/@font-face\s*\{/g)).toHaveLength(2);
  });

  it('объявляет вариативную ось wght 100 900 и swap на КАЖДОМ face', () => {
    // По одному вхождению на семейство — не «где-то в файле», а на каждом.
    expect(css.match(/font-weight:\s*100 900;/g)).toHaveLength(2);
    expect(css.match(/font-display:\s*swap;/g)).toHaveLength(2);
  });

  it('src каждого face ссылается на существующий валидный WOFF2', () => {
    for (const f of FACES) {
      expect(css).toContain(`url("./${f.file}") format("woff2")`);
      const bytes = readFileSync(join(pkgRoot, f.file));
      // Магия WOFF2 = ASCII 'wOF2' (0x774F4632) — доказывает, что это шрифт,
      // а не HTML-заглушка/LFS-указатель, случайно попавший под тем же именем.
      expect(bytes.subarray(0, 4).toString('latin1')).toBe('wOF2');
      expect(bytes.length).toBeGreaterThan(10_000);
    }
  });

  it('несёт текст лицензии OFL 1.1 с копирайтом Vercel', () => {
    const ofl = readFileSync(join(pkgRoot, 'OFL.txt'), 'utf8');
    expect(ofl).toContain('SIL Open Font License, Version 1.1');
    expect(ofl).toContain('Copyright (c) 2023 Vercel');
  });

  it('SHA-256 бинарников пинится к upstream v1.7.2 и совпадает с PROVENANCE.md', () => {
    const provenance = readFileSync(join(pkgRoot, 'PROVENANCE.md'), 'utf8');
    for (const [file, expected] of Object.entries(EXPECTED_SHA256)) {
      const actual = createHash('sha256')
        .update(readFileSync(join(pkgRoot, file)))
        .digest('hex');
      // Байт-в-байт апстрим Geist v1.7.2 — подмена бинарника падает здесь.
      expect(actual, `${file}: SHA-256 != upstream v1.7.2`).toBe(expected);
      // Проза и машинный пин не расходятся: PROVENANCE.md несёт ровно этот хэш.
      expect(provenance, `PROVENANCE.md не содержит хэш ${file}`).toContain(expected);
    }
  });
});
