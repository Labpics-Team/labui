// Золотая сверка поезда: эмиссия ЖИВОГО движка (опубликованный @labpics/colors
// + паспорт labui.config.json) против замороженного Figma-якоря (figma-reference.css) — значение к значению,
// light и dark. Это сквозной гейт всей цепочки «Figma-замеры → паспорт →
// wasm-граница → переменные», через реальный npm-артефакт, а не исходники.
//
// Расхождения допустимы ТОЛЬКО из явного списка исключений, каждое — с
// причиной-законом. Новое расхождение = красный тест, а не расширение списка.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

import { PASSPORT_FINGERPRINT, createLabuiEngine } from '../engine.mjs';
import passport from '../labui.config.json' with { type: 'json' };
import { M_LMS_SRGB, M_OKLAB_LMS, gam, mulv } from '../oklab-math.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const stubCssPath = join(here, '..', '..', 'colors-stub', 'figma-reference.css');

/**
 * Исключения сверки — роли, где эмиссия движка НАМЕРЕННО расходится со стабом.
 * Каждая запись обязана нести закон-причину; пустеющий список — цель поезда.
 */
const EXPECTED_DIVERGENCES = new Map([
  // Сентимент-солвер смещает info от синего бренда (закон разведения оттенка);
  // стаб несёт до-законные Figma-значения.
  ['--lab-label-info-primary', 'разведение оттенка с брендом'],
  ['--lab-label-info-secondary', 'разведение оттенка с брендом'],
  ['--lab-label-info-tertiary', 'разведение оттенка с брендом'],
  ['--lab-border-info-base', 'разведение оттенка с брендом'],
  ['--lab-border-info-soft', 'разведение оттенка с брендом'],
  ['--lab-border-info-strong', 'разведение оттенка с брендом'],
  ['--lab-fill-info-primary', 'разведение оттенка с брендом'],
  ['--lab-fill-info-secondary', 'разведение оттенка с брендом'],
  ['--lab-fill-info-tertiary', 'разведение оттенка с брендом'],
  ['--lab-fx-glow-info', 'разведение оттенка с брендом'],
  // Снос ADR-0007 («Elevation contract»): плоские одноцветные fx-shadow-*
  // вытеснены слоёной лестницей --lab-elevation-* (packages/shadow); движок
  // рецептов больше не несёт, замороженный якорь хранит их как исторический
  // факт Figma-экспорта (RETIRED_ROLES в generate-contract.mjs).
  ['--lab-fx-shadow-minor', 'ADR-0007: роль снята с контракта'],
  ['--lab-fx-shadow-ambient', 'ADR-0007: роль снята с контракта'],
  ['--lab-fx-shadow-penumbra', 'ADR-0007: роль снята с контракта'],
  ['--lab-fx-shadow-major', 'ADR-0007: роль снята с контракта'],
  // EC4 (focus-appearance, WCAG 2.4.13): focus-ring НАСЛЕДУЕТ сильный штрих
  // семьи Label (label-{sentiment}-primary, WCAG ~16–20:1), а не эмитит сырой
  // Figma-акцент — тот на светлой теме проваливал 3:1 (warning/success ~2.0).
  // Движок канон-обоснованно прав (доступность по построению); figma-reference
  // несёт до-законный сырой акцент — владелец реконсайлит Figma отдельным
  // проходом. brand/danger/neutral/warning есть в стабе → исключение с законом;
  // success/info в стабе отсутствуют (добавлены позже Figma-якорей).
  ['--lab-fx-focus-ring-brand', 'EC4: focus-ring наследует label-strong, не сырой акцент'],
  ['--lab-fx-focus-ring-danger', 'EC4: focus-ring наследует label-strong, не сырой акцент'],
  ['--lab-fx-focus-ring-neutral', 'EC4: focus-ring наследует label-strong, не сырой акцент'],
  ['--lab-fx-focus-ring-warning', 'EC4: focus-ring наследует label-strong, не сырой акцент'],
  ['--lab-fx-focus-ring-info', 'EC4: focus-ring наследует label-strong (+ разведение оттенка)'],
  ['--lab-label-info-quaternary', 'разведение оттенка с брендом'],
  ['--lab-fill-info-quaternary', 'разведение оттенка с брендом'],
  // Лейблы и border-strong — СОЛВЕР, не статические чернила: текст обязан
  // решаться от фактического фона (LPC + WCAG-пол), статика стаба —
  // до-законный язык; солвер-солид ≈ композиту чернил в паре LSB на
  // дефолтном фоне, но адаптивен на любом.
  ['--lab-label-primary', 'лейбл решается солвером от фона'],
  ['--lab-label-secondary', 'лейбл решается солвером от фона'],
  ['--lab-label-tertiary', 'лейбл решается солвером от фона'],
  ['--lab-label-quaternary', 'лейбл решается солвером от фона'],
  ['--lab-border-strong', 'сильная ступень решается солвером от фона'],
  // Вагон M1 (закон пары): сентимент-лейблы мигрировали с «акцент+альфа»
  // на text-anchor тинт-лестницу — паспорт декларирует recipe
  // {kind: text-anchor, floor: aa-text}, солвер тянет тинт от чернил к
  // акценту от фактического фона; стаб несёт до-законную альфа-лестницу.
  ['--lab-label-brand-primary', 'M1: text-anchor тинт, солвер от фона'],
  ['--lab-label-brand-secondary', 'M1: text-anchor тинт, солвер от фона'],
  ['--lab-label-brand-tertiary', 'M1: text-anchor тинт, солвер от фона'],
  ['--lab-label-brand-quaternary', 'M1: text-anchor тинт, солвер от фона'],
  ['--lab-label-danger-primary', 'M1: text-anchor тинт, солвер от фона'],
  ['--lab-label-danger-secondary', 'M1: text-anchor тинт, солвер от фона'],
  ['--lab-label-danger-tertiary', 'M1: text-anchor тинт, солвер от фона'],
  ['--lab-label-danger-quaternary', 'M1: text-anchor тинт, солвер от фона'],
  ['--lab-label-success-primary', 'M1: text-anchor тинт, солвер от фона'],
  ['--lab-label-success-secondary', 'M1: text-anchor тинт, солвер от фона'],
  ['--lab-label-success-tertiary', 'M1: text-anchor тинт, солвер от фона'],
  ['--lab-label-success-quaternary', 'M1: text-anchor тинт, солвер от фона'],
  ['--lab-label-warning-primary', 'M1: text-anchor тинт, солвер от фона'],
  ['--lab-label-warning-secondary', 'M1: text-anchor тинт, солвер от фона'],
  ['--lab-label-warning-tertiary', 'M1: text-anchor тинт, солвер от фона'],
  ['--lab-label-warning-quaternary', 'M1: text-anchor тинт, солвер от фона'],
  // Та же сильная ступень для сентиментов: recipe {kind: ladder,
  // position: border-strong, floor: aa-ui} — солвер от фона. brand/danger
  // совпали со стабом побайтно (решение легло в акцент), потому их тут нет.
  ['--lab-border-success-strong', 'сильная ступень решается солвером от фона'],
  ['--lab-border-warning-strong', 'сильная ступень решается солвером от фона'],
  // Glow-семья теперь recipe {kind: glow, source: sentiment|brand}: эмиссия
  // солидом от РЕШЁННОГО солвером источника, а не сырой акцент @52 стаба.
  ['--lab-fx-glow-brand', 'glow от солвер-источника, не сырой акцент @52'],
  ['--lab-fx-glow-danger', 'glow от солвер-источника, не сырой акцент @52'],
  ['--lab-fx-glow-neutral', 'glow от солвер-источника, не сырой акцент @52'],
  ['--lab-fx-glow-warning', 'glow от солвер-источника, не сырой акцент @52'],
  // Figma-ошибка (заземлена): вся glow-семья @52, а FX/Glow/Inverted привязан
  // к сырому солиду Neutral/4 вместо лежащего рядом 4@52 — движок @52
  // консистентен и прав.
  ['--lab-fx-glow-inverted', 'Figma-недосмотр: солид вместо @52 всей glow-семьи'],
  // Провизорный литерал стаба без engine-деривации: закрывается задачей
  // деривации (точка на растяжке по контракту), не подгонкой.
  ['--lab-fill-neutral', 'PROVISIONAL стаба; деривация — открытая задача'],
  // Zero-токены: «нет цвета» by design — движок честно не эмитит невидимое,
  // стаб нёс заглушку той же семантики с α=0.
  ['--lab-fill-none', 'Zero-токен: невидимость эмитится отсутствием'],
  ['--lab-border-none', 'Zero-токен: невидимость эмитится отсутствием'],
  // Компонентная поверхность контрола (light: белая поверхность, dark:
  // fill-ступень) — производная компонентного уровня, маппится поездом.
  ['--lab-control-bg', 'компонентная поверхность — маппинг поезда'],
]);

/** Разобрать значения --lab-* из scope-блока стаба. Селектор ищется
 * multiline-регэкспом по началу строки: шапка-комментарий стаба упоминает те
 * же селекторы текстом, и поиск подстрокой цеплял комментарий, беря затем
 * «{» чужого блока — сверка dark читала light-значения. */
function parseScope(css, scopePattern) {
  const m = scopePattern.exec(css);
  if (!m) throw new Error(`scope не найден: ${scopePattern}`);
  const start = m.index;
  const open = css.indexOf('{', start);
  let depth = 1;
  let i = open + 1;
  while (depth > 0 && i < css.length) {
    if (css[i] === '{') depth++;
    if (css[i] === '}') depth--;
    i++;
  }
  const block = css.slice(open + 1, i - 1);
  const vars = new Map();
  for (const m of block.matchAll(/(--lab-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    vars.set(m[1], m[2].replace(/\/\*.*?\*\//g, '').trim());
  }
  return vars;
}

/** oklch(L% C H [/ A]) → те же 8-битные байты, что печатал бы hex движка. */
function oklchToRgbParts(css) {
  const inner = css.slice('oklch('.length, -1);
  const [lch, alphaPart] = inner.split(' / ');
  const [lRaw, cRaw, hRaw] = lch.trim().split(/\s+/);
  const L = Number.parseFloat(lRaw) / 100;
  const C = Number.parseFloat(cRaw);
  const H = (Number.parseFloat(hRaw) * Math.PI) / 180;
  const lms = mulv(M_OKLAB_LMS, [L, C * Math.cos(H), C * Math.sin(H)]).map((x) => x ** 3);
  const rgb = mulv(M_LMS_SRGB, lms).map((x) =>
    Math.min(255, Math.max(0, Math.round(gam(x) * 255))),
  );
  return { rgb, alpha: alphaPart ? Number.parseFloat(alphaPart) : null };
}

/** Нормализовать значение до сравнимой формы: hex/oklch → rgb(R G B), пробелы. */
function normalise(value) {
  const hex = value.match(/^#([0-9a-fA-F]{6})$/);
  if (hex) {
    const n = Number.parseInt(hex[1], 16);
    return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255})`;
  }
  // Единая oklch-форма движка (0.4.0+) сводится к rgb-байтам стаба той же
  // математикой Oklab, что у границы; альфа проходит насквозь как данные.
  if (value.startsWith('oklch(')) {
    const { rgb, alpha } = oklchToRgbParts(value);
    const base = `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]}`;
    return alpha === null || alpha === 1 ? `${base})` : `${base} / ${alpha})`;
  }
  // Солидные лестничные позиции граница печатает как rgb(r g b / 1) —
  // семантически тот же солид, что rgb(r g b) стаба.
  return value
    .replace(/\s*\/\s*1\)$/, ')')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('золотая сверка: живой движок против стаба', () => {
  /** @type {{colors: any, fingerprint: string}} */
  let engine;
  /** @type {string} */
  let stubCss;

  beforeAll(async () => {
    engine = await createLabuiEngine();
    stubCss = await readFile(stubCssPath, 'utf8');
  });

  it('паспорт не дрейфанул: отпечаток равен пину', () => {
    expect(engine.fingerprint).toBe(PASSPORT_FINGERPRINT);
  });

  for (const [theme, scope, bg] of [
    // Фоны резолва — якоря нейтрали паспорта, не литералы.
    ['light', /^:root,\s*\r?\n\[data-theme="light"\]\s*\{/m, passport.neutral.anchors.light],
    ['dark', /^\[data-theme="dark"\]\s*\{/m, passport.neutral.anchors.dark],
  ]) {
    // Боевой гейт поезда: каждое значение стаба воспроизведено движком или
    // исключено ЗАКОНОМ (список исключений с причинами выше). Новое
    // расхождение = красный тест, а не строка в списке.
    it(`${theme}: каждая переменная стаба воспроизведена движком или исключена законом`, () => {
      const stub = parseScope(stubCss, scope);
      const resolved = engine.colors.resolveTheme(bg, theme);
      const live = new Map(Object.entries(resolved.vars));

      const unexpected = [];
      const stale = [];
      for (const [name, stubValue] of stub) {
        if (stubValue.startsWith('var(')) continue; // алиас-ссылки сверяются целью
        const liveValue = live.get(name);
        if (liveValue === undefined) {
          // Роль стаба, которую движок не эмитит: легальна только коллапс-зона
          // (bg-*/static/on-*/material — входы и флаги, не роли эмиссии).
          const collapsed =
            name.startsWith('--lab-bg-') ||
            name.includes('static') ||
            name.includes('-on-') ||
            name.includes('material') ||
            name.startsWith('--lab-label-inverted') ||
            name === '--lab-border-inverted' ||
            name.startsWith('--lab-badge-');
          if (!collapsed && !EXPECTED_DIVERGENCES.has(name)) stale.push(name);
          continue;
        }
        if (normalise(liveValue) !== normalise(stubValue)) {
          if (!EXPECTED_DIVERGENCES.has(name)) {
            unexpected.push(`${name}: стаб ${stubValue} != движок ${liveValue}`);
          }
        }
      }
      expect(unexpected, 'нелегальные расхождения значений').toEqual([]);
      expect(stale, 'роли стаба без эмиссии и без закона-исключения').toEqual([]);
    });
  }
});
