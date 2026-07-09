#!/usr/bin/env node
/**
 * docs-drift guard for labui (по образцу lab-icons feat/docs-drift-gate).
 *
 * Доки vs реальность — сверяет утверждения docs/NAMING.md с фактами ФС
 * (факты собирает scripts/naming-inventory.mjs, единый источник):
 *
 *   1. docs/NAMING.md существует и объявляет роль в первых 5 строках.
 *   2. Инвентарная таблица «сверяется гейтом»: числа в доке == факты ФС
 *      (пакеты, кастомные элементы, --lab-* декларации, отступления CSS).
 *   3. Пакеты двусторонне: каждый workspace-пакет упомянут в NAMING.md;
 *      каждое упоминание @labpics/*|@labui/* существует в workspace
 *      (или во внешнем allowlist — пакеты соседних репо экосистемы).
 *   4. Каждый тег `lab-*`, упомянутый в NAMING.md, есть в реестре
 *      customElements.define (фантомные теги в доке запрещены).
 *   5. Закон префикса CSS: каждая не---lab- декларация в packages/**
 *      перечислена в разделе «Известные отступления», и наоборот —
 *      исчезнувшее из кода отступление обязано уйти из доки.
 *   6. Файлы src вне закона имён (kebab / Pascal для .astro|.svelte)
 *      перечислены в «Известных отступлениях».
 *
 * Функции чистые и экспортируются — поведение проверяемо юнитами.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, collectInventory } from './naming-inventory.mjs';

/** Пакеты соседних репо Labics-Team, легитимно упоминаемые докой. */
export const EXTERNAL_PACKAGES = new Set(['@labpics/motion']);

/* ------------------------------------------------------------------ *
 * 1. Роль дока                                                        *
 * ------------------------------------------------------------------ */

export function hasDocRole(text) {
  const head = text.split('\n').slice(0, 5).join('\n');
  return /(справка|ADR|канон|гайд|отчёт|роль:)/i.test(head);
}

/* ------------------------------------------------------------------ *
 * 2. Инвентарная таблица                                              *
 * ------------------------------------------------------------------ */

/** Строки `| метка | N |` из таблицы под заголовком «Инвентарь». */
export function extractInventoryTable(text) {
  const rows = new Map();
  for (const m of text.matchAll(/^\|\s*([^|]+?)\s*\|\s*(\d+)\s*\|\s*$/gm)) {
    rows.set(m[1], Number(m[2]));
  }
  return rows;
}

/** Метрика доки → факт ФС; ключ ищется подстрокой в метке строки. */
export function inventoryTableErrors(rows, inv) {
  const expected = [
    ['workspace-пакетов', inv.packages.length],
    ['кастомных элементов', inv.tags.length],
    ['`--lab-*`', inv.labVars.length],
    ['вне `--lab-*`', inv.nonLabVars.length],
  ];
  const errs = [];
  for (const [key, fact] of expected) {
    const row = [...rows.entries()].find(([label]) => label.includes(key));
    if (!row) {
      errs.push(`NAMING.md: в инвентарной таблице нет строки «${key}»`);
    } else if (row[1] !== fact) {
      errs.push(`NAMING.md: «${row[0]}» = ${row[1]}, факт ФС = ${fact}`);
    }
  }
  return errs;
}

/* ------------------------------------------------------------------ *
 * 3. Пакеты                                                           *
 * ------------------------------------------------------------------ */

export function packageMentionErrors(text, packages) {
  const errs = [];
  const real = new Set(packages.map((p) => p.name));
  for (const p of packages) {
    if (!text.includes(p.name)) {
      errs.push(`NAMING.md не упоминает workspace-пакет ${p.name} (${p.dir})`);
    }
  }
  for (const m of text.matchAll(/@lab(?:pics|ui)\/[a-z0-9-]+/g)) {
    if (!real.has(m[0]) && !EXTERNAL_PACKAGES.has(m[0])) {
      errs.push(`NAMING.md упоминает несуществующий пакет ${m[0]}`);
    }
  }
  return errs;
}

/* ------------------------------------------------------------------ *
 * 4. Теги кастомных элементов                                         *
 * ------------------------------------------------------------------ */

/** Бэктик-упоминания тегов `lab-…` (файлы вроде `lab-button.ts` — не теги). */
export function extractTagMentions(text) {
  return [...text.matchAll(/`(lab-[a-z][a-z0-9-]*)`/g)].map((m) => m[1]);
}

export function tagMentionErrors(text, tags) {
  const real = new Set(tags);
  return extractTagMentions(text)
    .filter((t) => !real.has(t))
    .map((t) => `NAMING.md упоминает незарегистрированный тег \`${t}\``);
}

/* ------------------------------------------------------------------ *
 * 5–6. Известные отступления                                          *
 * ------------------------------------------------------------------ */

/** Текст раздела «Известные отступления» (до следующего `## `). */
export function deviationsSection(text) {
  const m = text.match(/^##[^\n]*Известные отступления[^\n]*\n([\s\S]*?)(?=^## |\n*$(?![\s\S]))/m);
  return m ? m[1] : '';
}

export function cssLawErrors(section, nonLabVars) {
  const errs = [];
  for (const v of nonLabVars) {
    if (!section.includes(`\`${v.name}\``)) {
      errs.push(
        `декларация ${v.name} (${v.files[0]}) вне --lab-* не зафиксирована в «Известных отступлениях»`,
      );
    }
  }
  const declared = new Set(nonLabVars.map((v) => v.name));
  for (const m of section.matchAll(/`(--(?!lab-)[a-z][\w-]*)`/g)) {
    if (!declared.has(m[1])) {
      errs.push(
        `«Известные отступления» перечисляют ${m[1]}, но в packages/** такой декларации больше нет — убери из доки`,
      );
    }
  }
  return errs;
}

export function fileLawErrors(section, nonKebab) {
  return nonKebab
    .filter((f) => !section.includes(f))
    .map((f) => `файл вне закона имён не зафиксирован в «Известных отступлениях»: ${f}`);
}

/* ------------------------------------------------------------------ *
 * Аудит целиком                                                       *
 * ------------------------------------------------------------------ */

export function auditRepo(root = ROOT) {
  const errors = [];
  const namingPath = join(root, 'docs', 'NAMING.md');
  const inv = collectInventory(root);
  if (!existsSync(namingPath)) {
    return { errors: ['docs/NAMING.md отсутствует — канона нет'], inv };
  }
  const text = readFileSync(namingPath, 'utf8');

  if (!hasDocRole(text)) {
    errors.push('docs/NAMING.md: роль не объявлена в первых 5 строках');
  }
  errors.push(...inventoryTableErrors(extractInventoryTable(text), inv));
  errors.push(...packageMentionErrors(text, inv.packages));
  errors.push(...tagMentionErrors(text, inv.tags));
  const section = deviationsSection(text);
  if (!section) {
    errors.push('docs/NAMING.md: нет раздела «Известные отступления»');
  }
  errors.push(...cssLawErrors(section, inv.nonLabVars));
  errors.push(...fileLawErrors(section, inv.nonKebab));

  return { errors, inv };
}

/* ------------------------------------------------------------------ */

const isCLI = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCLI) {
  const { errors, inv } = auditRepo(ROOT);
  console.info(
    `check-docs-drift: факт ФС — пакетов ${inv.packages.length}, ` +
      `элементов ${inv.tags.length}, --lab-* ${inv.labVars.length}, ` +
      `вне --lab-* ${inv.nonLabVars.length}`,
  );
  if (errors.length) {
    for (const e of errors) console.error(`  ✗ ${e}`);
    console.error(`check-docs-drift: FAIL (${errors.length})`);
    process.exit(1);
  }
  console.info('check-docs-drift: PASS — доки совпадают с реальностью');
}
