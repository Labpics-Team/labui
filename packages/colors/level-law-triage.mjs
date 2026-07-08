// ТРИАЖ ОТКЛОНЕНИЙ ЗАКОНА УРОВНЕЙ D1/D2/D5 (задача #99) — воспроизводимый замер
// поверх той же эмиссии contract.css, что питает гейт. НЕ гейт: только печатает
// таблицы и проверяет АЛЬТЕРНАТИВНЫЕ инварианты гипотез из шапки level-law.test.
// Не трогает level-law.mjs / level-law.test.mjs (импортирует их публичный API).
//
// Запуск: node packages/colors/level-law-triage.mjs
// Тон здесь — тот же oklab-J' (level-law.mjs), для МОНОТОННОСТИ и относительных
// сравнений семей; паспортные CAM16-цели тут не участвуют.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BG_ANCHOR,
  BORDER_LEVELS,
  FILL_LEVELS,
  LABEL_LEVELS,
  SENTIMENTS,
  alphaOf,
  effectiveHex,
  jprime,
  parseScopes,
  resolveVar,
  toneOf,
  varName,
} from './level-law.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const css = await readFile(join(here, '..', 'colors-stub', 'contract.css'), 'utf8');
const S = parseScopes(css);
const THEMES = ['light', 'dark'];
const FILL_FAMS = ['neutral', ...SENTIMENTS];

const f2 = (x) => (x == null ? '   —  ' : x.toFixed(2).padStart(6));
const f3 = (x) => (x == null ? '   —   ' : x.toFixed(3).padStart(7));
const pad = (s, n) => String(s).padEnd(n);

/** J' СОЛИДНОГО тона семьи (оверлей при alpha=1) — «светлота тинта». */
function solidJ(map, name) {
  const raw = map.get(name);
  if (raw == null) return null;
  const v = resolveVar(map, raw);
  // Форсировать непрозрачность: убрать «/ α» — effectiveHex вернёт сам цвет.
  const opaque = v.replace(/\s*\/\s*[\d.]+\s*\)/, ')');
  const hex = effectiveHex(map, opaque, '#000000');
  return hex ? jprime(hex) : null;
}

/** Пирсон r по парам (для D2: solidJ ↔ |dJ'|). */
function pearson(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}

console.info('# ТРИАЖ D1/D2/D5 — воспроизводимый замер по contract.css');
console.info(
  `# bg light=${BG_ANCHOR.light} (J'=${jprime(BG_ANCHOR.light).toFixed(2)}); dark=${BG_ANCHOR.dark} (J'=${jprime(BG_ANCHOR.dark).toFixed(2)})`,
);

// ─────────────────────────────────────────────────────────────────────────────
// D1 — ДВЕ ФИЗИКИ ЛЕСТНИЦ: нейтраль (HIG system-fill) vs сентименты (тинт).
// Таблица dJ' по семьям × уровням (обе темы) + Δ vs нейтраль; таблица α +
// проверка альтернативного инварианта «α-лестница монотонна внутри семьи».
// ─────────────────────────────────────────────────────────────────────────────
console.info("\n\n========== D1 — dJ' fill-лестницы (тон) ==========");
for (const theme of THEMES) {
  console.info(`\n-- ${theme.toUpperCase()} — dJ' (и Δ = семья − нейтраль) --`);
  console.info(`${pad('family', 10)} ${FILL_LEVELS.map((l) => pad(l, 8)).join(' ')}`);
  const neu = FILL_LEVELS.map(
    (lvl) => toneOf(S[theme], varName('fill', 'neutral', lvl), BG_ANCHOR[theme]).dJ,
  );
  for (const fam of FILL_FAMS) {
    const row = FILL_LEVELS.map(
      (lvl) => toneOf(S[theme], varName('fill', fam, lvl), BG_ANCHOR[theme]).dJ,
    );
    const cells = row.map((d, i) => {
      const delta =
        fam === 'neutral' ? '' : `(${(d - neu[i] >= 0 ? '+' : '') + (d - neu[i]).toFixed(2)})`;
      return pad(`${f2(d)}${delta}`, 8);
    });
    console.info(`${pad(fam, 10)} ${cells.join(' ')}`);
  }
}

console.info('\n\n========== D1 — α-лестница fill (альтернативный инвариант) ==========');
let d1AllMono = true;
for (const theme of THEMES) {
  console.info(
    `\n-- ${theme.toUpperCase()} — α по уровням; MONO = строго убывает primary→quaternary --`,
  );
  console.info(`${pad('family', 10)} ${FILL_LEVELS.map((l) => pad(l, 8)).join(' ')}  MONO`);
  for (const fam of FILL_FAMS) {
    const a = FILL_LEVELS.map((lvl) => alphaOf(S[theme], S[theme].get(varName('fill', fam, lvl))));
    let mono = true;
    for (let i = 1; i < a.length; i++) if (!(a[i] < a[i - 1])) mono = false;
    if (!mono) d1AllMono = false;
    console.info(
      `${pad(fam, 10)} ${a.map((x) => pad(f3(x), 8)).join(' ')}  ${mono ? 'да' : 'НЕТ'}`,
    );
  }
}
console.info(
  `\nИТОГ D1(fill): α-лестница монотонна во ВСЕХ семьях обеих тем: ${d1AllMono ? 'ДА (инвариант держится без исключений)' : 'НЕТ'}`,
);

console.info(
  '\n\n========== D1 — border-когорта: base/soft = translucent-тинт, strong = opaque (D3) ==========',
);
let d1BorderBaseSoft = true;
for (const theme of THEMES) {
  console.info(
    `\n-- ${theme.toUpperCase()} — α по уровням border (strong/base/soft); base>soft = tint-монотон --`,
  );
  console.info(`${pad('family', 10)} ${BORDER_LEVELS.map((l) => pad(l, 8)).join(' ')}  base>soft`);
  for (const fam of FILL_FAMS) {
    const a = BORDER_LEVELS.map((lvl) =>
      alphaOf(S[theme], S[theme].get(varName('border', fam, lvl))),
    );
    const [strong, base, soft] = a; // BORDER_LEVELS = strong,base,soft
    const baseSoftMono = base != null && soft != null && soft < base;
    if (!baseSoftMono) d1BorderBaseSoft = false;
    const strongTag = strong === 1 ? 'opaque(D3)' : String(strong);
    console.info(
      `${pad(fam, 10)} ${pad(strongTag, 8)} ${pad(f3(base), 8)} ${pad(f3(soft), 8)}  ${baseSoftMono ? 'да' : 'НЕТ'}`,
    );
  }
}
console.info(
  `\nИТОГ D1(border): base>soft (translucent-тинт) монотонно во всех семьях: ${d1BorderBaseSoft ? 'ДА' : 'НЕТ'}; strong — opaque контраст-якорь (D3, вне тон-лестницы).`,
);

// ─────────────────────────────────────────────────────────────────────────────
// D2 — ОТТЕНОК ЛОМАЕТ ТОН при равной α: тон = f(α, светлота тинта). Показать
// корреляцию dJ' от solidJ (светлота солидного тинта) при ФИКСИРОВАННОЙ α.
// ─────────────────────────────────────────────────────────────────────────────
console.info('\n\n========== D2 — тон = f(α, светлота тинта) ==========');
for (const theme of THEMES) {
  console.info(`\n-- ${theme.toUpperCase()} --`);
  const solids = SENTIMENTS.map((f) => ({
    f,
    sJ: solidJ(S[theme], varName('fill', f, 'primary')),
  }));
  solids.sort((a, b) => a.sJ - b.sJ); // от тёмного тинта к светлому
  console.info(
    `solidJ' (светлота солидного тинта, по возрастанию): ${solids.map((s) => `${s.f} ${s.sJ.toFixed(2)}`).join(' | ')}`,
  );
  console.info(
    `\n${pad('sentiment', 10)} ${pad("solidJ'", 8)} ${FILL_LEVELS.map((l) => pad(`dJ'·${l.slice(0, 4)}`, 9)).join(' ')}`,
  );
  for (const { f, sJ } of solids) {
    const dj = FILL_LEVELS.map(
      (lvl) => toneOf(S[theme], varName('fill', f, lvl), BG_ANCHOR[theme]).dJ,
    );
    console.info(
      `${pad(f, 10)} ${pad(sJ.toFixed(2), 8)} ${dj.map((d) => pad(f2(d), 9)).join(' ')}`,
    );
  }
  // Корреляция solidJ ↔ |dJ'| на каждом уровне (фиксированная α).
  console.info(`\nПирсон r(solidJ', |dJ'|) при фиксированной α по уровням:`);
  for (const lvl of FILL_LEVELS) {
    const xs = SENTIMENTS.map((f) => solidJ(S[theme], varName('fill', f, 'primary')));
    const ys = SENTIMENTS.map((f) =>
      Math.abs(toneOf(S[theme], varName('fill', f, lvl), BG_ANCHOR[theme]).dJ),
    );
    // Порядковая монотонность: |dJ'| строго убывает при росте solidJ'?
    const order = SENTIMENTS.map((f, i) => ({ s: xs[i], y: ys[i] })).sort((a, b) => a.s - b.s);
    let strictInv = true;
    for (let i = 1; i < order.length; i++) if (!(order[i].y < order[i - 1].y)) strictInv = false;
    console.info(
      `  ${pad(lvl, 11)} r=${pearson(xs, ys).toFixed(4)}  |dJ'| строго убывает по solidJ': ${strictInv ? 'да' : 'НЕТ'}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// D5 — INVERTED label primary вырожден: происхождение = Figma-мост (renderScope
// else-ветка), НЕ движок. Печатаем эмитированное значение + тег моста + dJ'.
// ─────────────────────────────────────────────────────────────────────────────
console.info('\n\n========== D5 — label-inverted: происхождение и вырождение ==========');
for (const theme of THEMES) {
  console.info(`\n-- ${theme.toUpperCase()} (bg=${BG_ANCHOR[theme]}) --`);
  for (const lvl of LABEL_LEVELS) {
    const name = varName('label', 'inverted', lvl);
    const raw = S[theme].get(name);
    const t = toneOf(S[theme], name, BG_ANCHOR[theme]);
    const degen = Math.abs(t.dJ) < 0.5;
    console.info(
      `  ${pad(lvl, 11)} raw=${pad(resolveVar(S[theme], raw), 26)} dJ'=${f2(t.dJ)}  ${degen ? "← ВЫРОЖДЕН (|dJ'|<0.5)" : ''}`,
    );
  }
}
// Доказательство происхождения: тег комментария в сырой эмиссии (не резолв).
console.info('\nТег эмиссии в contract.css (renderScope):');
const reLbl = /(--lab-label-inverted-primary):\s*([^;]+);\s*(\/\*[^*]*\*\/)?/g;
for (const m of css.matchAll(reLbl)) {
  console.info(`  ${m[1]}: ${m[2].trim()}; ${m[3] || ''}`.trim());
}
