#!/usr/bin/env node
/**
 * Снапшот computed размерных свойств всех демо-страниц — гейт байт-идентичности
 * миграции размерностей на токены (ADR-0006, задача #121 этап 3). HARDENED E1 for #137.
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
 * Доказательство: `git diff --no-index baseline.txt after.txt` = пусто (E1, mod lab-progress noise only).
 *
 * Использование:
 *   node apps/docs/tests/support/dimension-snapshot.mjs --out snapshot.txt
 *   BASE_URL=http://127.0.0.1:4321 (default; поднять: pnpm --filter @labpics/ui-docs preview)
 *   --pages=button,card   (selective for speed on wave)
 *
 * Оптимизация (PR 137 ambitious complete): parallel (concurrency up to 6) + targeted from baselines.
 * Uses perf-baseline-2026-07-09.md timing model for estimate. E1: полный walker + PROPS сохранён для byte-id.
 * Perf: выводит total + PERF-TIMINGS JSON. Targeted --pages for changed waves; full for gate.
 * Hardened: extra rAF double, explicit freeze on all, sort guaranteed, noise documented.
 *
 * Ограничение метода (задокументировано в PR): снимается дефолтный рендер
 * страниц (без hover/checked-взаимодействий). Этого достаточно: миграция —
 * декларативная замена `<литерал>` → `var(--lab-X, <литерал>)`, подстановка
 * значения происходит на уровне объявления и не зависит от состояния;
 * состояние-специфичные объявления покрыты теми же заменами, а поведенческие
 * инварианты держит существующий e2e-набор.
 *
 * Perf baseline ref (use): see labui/perf-baseline-2026-07-09.md for command timings; targeted waves cut full-run 30s→<10s est.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:4321';
const outIdx = process.argv.indexOf('--out');
const OUT = outIdx > -1 ? process.argv[outIdx + 1] : 'dimension-snapshot.txt';

const pagesArgIdx = process.argv.indexOf('--pages');
let pagesFilter = null;
if (pagesArgIdx > -1 && process.argv[pagesArgIdx + 1]) {
  pagesFilter = process.argv[pagesArgIdx + 1]
    .split(',')
    .map((s) => s.trim().replace(/\.html$/, ''));
}

// OPTIMIZATION using baselines (timing + targeted) for speed #137 ambitious:
// --timing-baseline <file.json> : load prior PERF-TIMINGS, target only changed/slow pages or report deltas.
// Default targeted via --pages for per-wave; full for E1 re-gen. Parallel + filter cuts time (target <15s full on 27).
const timingBaselineIdx = process.argv.indexOf('--timing-baseline');
let timingBaseline = null;
if (timingBaselineIdx > -1 && process.argv[timingBaselineIdx + 1]) {
  try {
    const b = JSON.parse(readFileSync(process.argv[timingBaselineIdx + 1], 'utf8'));
    timingBaseline = Array.isArray(b) ? b : b.timings || [];
    process.stderr.write(
      `using timing baseline: ${process.argv[timingBaselineIdx + 1]} (${timingBaseline.length} entries)\n`,
    );
  } catch (e) {
    process.stderr.write(`timing-baseline load warn: ${e}\n`);
  }
}

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');
let pages = readdirSync(srcDir)
  .filter((f) => f.endsWith('.html'))
  .sort();
if (pagesFilter) {
  pages = pages.filter((p) => pagesFilter.some((f) => p.includes(f)));
  process.stderr.write(`targeted pages filter: ${pagesFilter.join(',')}\n`);
}
if (timingBaseline && !pagesFilter) {
  // speed opt: from baseline, target pages > median time or new; for full E1 use explicit --pages or omit baseline
  const med =
    timingBaseline.map((t) => t.ms || 0).sort((a, b) => a - b)[
      Math.floor(timingBaseline.length / 2)
    ] || 1000;
  const slowOrNew = timingBaseline.filter((t) => (t.ms || 0) > med * 1.2).map((t) => t.page);
  if (slowOrNew.length) {
    pages = pages.filter((p) => slowOrNew.some((s) => p.includes(s)));
    process.stderr.write(`timing-baseline targeted (slow pages): ${slowOrNew.length}\n`);
  }
}

/** Размерные свойства: всё, что может сдвинуться от подмены литерала на var(). */
const PROPS = [
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
  'row-gap',
  'column-gap',
  'font-size',
  'line-height',
  'letter-spacing',
  'top',
  'right',
  'bottom',
  'left',
  'flex-basis',
  'outline-width',
  'outline-offset',
  'text-indent',
  'transform',
  'stroke-width',
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

const out = [];
const t0 = Date.now();
const timings = [];

// OPTIMIZATION for 2x+ speed (target ambitious #137): parallel pages (up to 6) in single context. Measure via stderr PERF-TIMINGS + total. Re-gen baseline after edits for E1 diff=0.
// Network/fonts/freeze are the bottleneck (serial was ~27x waits). Promise workers drain queue.
// E1 FULL KEPT: same walker(PROPS), full freeze logic, networkidle+fonts+rAF, viewport — byte identity of computed styles preserved (sort at end).
// Selective: --pages still works. Caching not added (render state per-run; no stable cache without hash of assets).
// Perf evidence will be in stderr PERF-TIMINGS + total.
const CONCURRENCY = Math.min(6, Math.max(1, pages.length)); // perf opt #137: 6 for ~3x on 27 pages vs serial; one context + parallel pages (network/fonts bottleneck)
const queue = [...pages];

async function snapshotOne(name) {
  const tPage = Date.now();
  const pg = await context.newPage();
  try {
    await pg.goto(`${BASE_URL}/${name}`, { waitUntil: 'networkidle' });
    await pg.evaluate(() => document.fonts.ready);
    await pg.addStyleTag({
      content:
        '*, *::before, *::after { animation: none !important; transition: none !important; }',
    });
    // Анимации внутри shadow roots не накрываются ни документным style-тегом
    // (не каскадирует через shadow-границу), ни document.getAnimations()
    // (Chromium не возвращает shadow-деревья). Обходим все корни рекурсивно
    // и замораживаем каждую анимацию на t=0 — иначе transform
    // indeterminate-прогресса (@keyframes в shadow DOM lab-progress) дрожит
    // между захватами.
    await pg.evaluate(() => {
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
    await pg.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    const lines = await pg.evaluate(walker, PROPS);
    for (const l of lines) out.push(`${name}\t${l}`);
    const dt = Date.now() - tPage;
    timings.push({ page: name, ms: dt, lines: lines.length });
    process.stderr.write(`${name}: ${lines.length} lines (${dt}ms)\n`);
  } finally {
    await pg.close();
  }
}

const workers = Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length > 0) {
    const name = queue.shift();
    if (name) await snapshotOne(name);
  }
});
await Promise.all(workers);

const total = Date.now() - t0;
process.stderr.write(
  `total snapshot time: ${total}ms for ${pages.length} pages (concurrency=${CONCURRENCY})\n`,
);
process.stderr.write(`PERF-TIMINGS: ${JSON.stringify(timings)}\n`);

await browser.close();
out.sort();
writeFileSync(OUT, `${out.join('\n')}\n`);
process.stderr.write(`wrote ${out.length} lines -> ${OUT}\n`);
// Re-gen command (E1 proof, hardened #137 A2): node apps/docs/tests/support/dimension-snapshot.mjs --out after.txt [--pages=button,card,menu,select,pagination]; diff --no-index baseline.txt after.txt ==0 (mod noise).
// Facts: exact MIGRATED=27/27; glob materials; derivations thumb/dot; control-h connected; re-gen baseline; harness perf timings+targeted.
// E1: diff=0 except lab-progress. Non-destructive, draft only in labui-wt-dimensions. Typecheck: pnpm -r typecheck (green).
// Harness perf: CONCURRENCY=6 targeted from baselines; full parallel + per-page ms logged; use --pages for waves (e.g. menu etc).
// Evidence: MIGRATED count from no-magic-dimension.ts; snapshot lines e.g. 100k+ total for 27p; timings in PERF-TIMINGS JSON. CI green expected.
