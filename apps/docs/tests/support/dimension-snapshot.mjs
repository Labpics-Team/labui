#!/usr/bin/env node
/**
 * Снапшот computed размерных свойств всех демо-страниц — гейт байт-идентичности
 * миграции размерностей на токены (ADR-0006, задача #121 этап 3).
 *
 * Метод: для каждой страницы apps/docs/src/*.html рендерим её в chromium
 * (fixed viewport 1280×720, dpr 1, prefers-reduced-motion), дожидаемся шрифтов,
 * детерминированно отключаем анимации/переходы (animation:none — одинаково в
 * baseline и after, поэтому diff остаётся валидным), замораживаем
 * Web-Animations-API-анимации (element.animate не накрывается animation:none;
 * document.getAnimations() → pause() + currentTime=0), затем обходим весь DOM
 * ВКЛЮЧАЯ shadow roots и псевдоэлементы ::before/::after и дампим
 * getComputedStyle по списку размерных свойств.
 *
 * Формат вывода: сортированные строки `page\tpath\tprop\tvalue`.
 * Доказательство: `git diff --no-index baseline.txt after.txt` = пусто.
 *
 * Использование:
 *   node apps/docs/tests/support/dimension-snapshot.mjs --out snapshot.txt
 *   BASE_URL=http://127.0.0.1:4321 (default; поднять: pnpm --filter @labpics/ui-docs preview)
 *
 * Ограничение метода (задокументировано в PR): снимается дефолтный рендер
 * страниц (без hover/checked-взаимодействий). Этого достаточно: миграция —
 * декларативная замена `<литерал>` → `var(--lab-X, <литерал>)`, подстановка
 * значения происходит на уровне объявления и не зависит от состояния;
 * состояние-специфичные объявления покрыты теми же заменами, а поведенческие
 * инварианты держит существующий e2e-набор.
 */
import { readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:4321';
const outIdx = process.argv.indexOf('--out');
const OUT = outIdx > -1 ? process.argv[outIdx + 1] : 'dimension-snapshot.txt';

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');
const pages = readdirSync(srcDir)
  .filter((f) => f.endsWith('.html'))
  .sort();

/** Размерные свойства: всё, что может сдвинуться от подмены литерала на var(). */
const PROPS = [
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-right-radius', 'border-bottom-left-radius',
  'row-gap', 'column-gap', 'font-size', 'line-height', 'letter-spacing',
  'top', 'right', 'bottom', 'left', 'flex-basis',
  'outline-width', 'outline-offset', 'text-indent', 'transform', 'stroke-width',
];

const walker = (propsList) => {
  const lines = [];
  const read = (el, pseudo, path) => {
    const cs = getComputedStyle(el, pseudo);
    if (pseudo && cs.content === 'none') return;
    const suffix = pseudo ? `::${pseudo.replace(/:/g, '')}` : '';
    for (const p of propsList) lines.push(`${path}${suffix}\t${p}\t${cs.getPropertyValue(p)}`);
  };
  const walk = (root, prefix) => {
    const kids = root.children ?? [];
    for (let i = 0; i < kids.length; i++) {
      const el = kids[i];
      if (el.localName === 'script' || el.localName === 'style') continue;
      const path = `${prefix}>${el.localName}:${i}`;
      read(el, null, path);
      read(el, '::before', path);
      read(el, '::after', path);
      if (el.shadowRoot) walk(el.shadowRoot, `${path}#s`);
      walk(el, path);
    }
  };
  walk(document.documentElement, 'html');
  return lines;
};

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
});
const page = await context.newPage();

const out = [];
for (const name of pages) {
  await page.goto(`${BASE_URL}/${name}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content: '*, *::before, *::after { animation: none !important; transition: none !important; }',
  });
  // Анимации внутри shadow roots не накрываются ни документным style-тегом
  // (не каскадирует через shadow-границу), ни document.getAnimations()
  // (Chromium не возвращает shadow-деревья). Обходим все корни рекурсивно
  // и замораживаем каждую анимацию на t=0 — иначе transform
  // indeterminate-прогресса (@keyframes в shadow DOM lab-progress) дрожит
  // между захватами.
  await page.evaluate(() => {
    const freeze = (a) => {
      try {
        a.pause();
        a.currentTime = 0;
      } catch {
        /* transition без активного effect и т.п. */
      }
    };
    const walk = (root) => {
      for (const el of root.querySelectorAll('*')) {
        for (const a of el.getAnimations({ subtree: true })) freeze(a);
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    for (const a of document.getAnimations()) freeze(a);
    walk(document);
  });
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  const lines = await page.evaluate(walker, PROPS);
  for (const l of lines) out.push(`${name}\t${l}`);
  process.stderr.write(`${name}: ${lines.length} lines\n`);
}

await browser.close();
out.sort();
writeFileSync(OUT, `${out.join('\n')}\n`);
process.stderr.write(`wrote ${out.length} lines -> ${OUT}\n`);
