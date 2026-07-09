#!/usr/bin/env node
/**
 * naming-inventory — фактический нейминг-инвентарь labui.
 *
 * Роль: справка-скрипт и библиотека фактов ФС. Единственный источник фактов
 * для docs/NAMING.md и scripts/check-docs-drift.mjs (гейт импортирует отсюда,
 * чтобы дока и гейт сверялись с ОДНОЙ реальностью, а не с двумя копиями).
 *
 * Инвентарь:
 *   1. workspace-пакеты (packages/*, apps/*): директория → имя npm-пакета;
 *   2. кастомные элементы: теги из customElements.define('lab-…') в src
 *      (комментарии вырезаются — докстринги с примерами не считаются);
 *   3. декларации CSS-кастом-свойств в packages/**: --lab-* и прочие;
 *   4. файлы src, нарушающие kebab-case.
 *
 * CLI: `node scripts/naming-inventory.mjs` — сводка + полный JSON.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, '..');

/** Генерируемое/чужое — не инвентарь. */
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  'artifacts',
  'coverage',
  'playwright-report',
  'test-results',
  '.astro',
]);

/** Рекурсивный список файлов (POSIX-пути относительно base). */
export function walk(dir, out = [], base = dir) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(join(dir, e.name), out, base);
    } else {
      out.push(relative(base, join(dir, e.name)).replaceAll('\\', '/'));
    }
  }
  return out;
}

/** Вырезает /*…*&#47; и //-комментарии: примеры в докстрингах — не реестр. */
export function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/** workspace-пакеты: [{ dir, name, version }] из packages/* и apps/*. */
export function workspacePackages(root = ROOT) {
  const pkgs = [];
  for (const group of ['packages', 'apps']) {
    const groupDir = join(root, group);
    if (!existsSync(groupDir)) continue;
    for (const e of readdirSync(groupDir, { withFileTypes: true })) {
      const manifest = join(groupDir, e.name, 'package.json');
      if (!e.isDirectory() || !existsSync(manifest)) continue;
      const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
      pkgs.push({ dir: `${group}/${e.name}`, name: pkg.name, version: pkg.version });
    }
  }
  return pkgs.sort((a, b) => a.dir.localeCompare(b.dir));
}

/** Теги кастомных элементов, реально регистрируемые в packages/**&#47;src. */
export function customElementTags(root = ROOT) {
  const tags = new Set();
  for (const { dir } of workspacePackages(root)) {
    if (!dir.startsWith('packages/')) continue;
    const src = join(root, dir, 'src');
    for (const f of walk(src)) {
      if (!/\.(ts|tsx|js|mjs)$/.test(f)) continue;
      const code = stripComments(readFileSync(join(src, f), 'utf8'));
      for (const m of code.matchAll(/customElements\.define\(\s*['"]([a-z0-9-]+)['"]/g)) {
        tags.add(m[1]);
      }
    }
  }
  return [...tags].sort();
}

/**
 * Декларации CSS-кастом-свойств в packages/** (публикуемые поверхности).
 * @returns {{ name: string, files: string[] }[]} уникальные имена + где объявлены.
 */
export function cssVarDeclarations(root = ROOT) {
  const byName = new Map();
  for (const { dir } of workspacePackages(root)) {
    if (!dir.startsWith('packages/')) continue;
    const pkgDir = join(root, dir);
    for (const f of walk(pkgDir)) {
      if (!f.endsWith('.css')) continue;
      const text = readFileSync(join(pkgDir, f), 'utf8');
      for (const m of text.matchAll(/^\s*(--[a-zA-Z][\w-]*)\s*:/gm)) {
        const name = m[1];
        if (!byName.has(name)) byName.set(name, new Set());
        byName.get(name).add(`${dir}/${f}`);
      }
    }
  }
  return [...byName.entries()]
    .map(([name, files]) => ({ name, files: [...files].sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Файлы packages/**&#47;src вне закона имён файлов.
 * Закон: kebab-case; исключение — одно-компонентные файлы фреймворков
 * (.astro, .svelte), где имя файла = PascalCase-имя компонента (механическая
 * транскрипция, граница слоёв — не дрейф).
 */
export function nonKebabSrcFiles(root = ROOT) {
  const bad = [];
  for (const { dir } of workspacePackages(root)) {
    if (!dir.startsWith('packages/')) continue;
    const src = join(root, dir, 'src');
    for (const f of walk(src)) {
      const base = f.split('/').pop();
      const stem = base.replace(/\.[^.]+(\.[^.]+)?$/, '');
      const law = /\.(astro|svelte)$/.test(base)
        ? /^[A-Z][A-Za-z0-9]*$/
        : /^[a-z0-9]+(-[a-z0-9]+)*$/;
      if (!law.test(stem)) bad.push(`${dir}/src/${f}`);
    }
  }
  return bad.sort();
}

/** Полный инвентарь одним объектом (факты для доки и гейта). */
export function collectInventory(root = ROOT) {
  const packages = workspacePackages(root);
  const tags = customElementTags(root);
  const cssVars = cssVarDeclarations(root);
  const labVars = cssVars.filter((v) => v.name.startsWith('--lab-'));
  const nonLabVars = cssVars.filter((v) => !v.name.startsWith('--lab-'));
  const nonKebab = nonKebabSrcFiles(root);
  return { packages, tags, cssVars, labVars, nonLabVars, nonKebab };
}

const isCLI = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCLI) {
  const inv = collectInventory(ROOT);
  console.info(
    `naming-inventory: пакетов ${inv.packages.length}, ` +
      `кастомных элементов ${inv.tags.length}, ` +
      `CSS-деклараций --lab-* ${inv.labVars.length}, ` +
      `вне --lab-* ${inv.nonLabVars.length}, ` +
      `src-файлов вне kebab ${inv.nonKebab.length}`,
  );
  console.info(JSON.stringify(inv, null, 2));
}
