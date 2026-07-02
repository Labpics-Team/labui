// Золотая сверка поезда: эмиссия ЖИВОГО движка (опубликованный @labpics/colors
// + паспорт labui.config.json) против стаба contract.css — значение к значению,
// light и dark. Это сквозной гейт всей цепочки «Figma-замеры → паспорт →
// wasm-граница → переменные», через реальный npm-артефакт, а не исходники.
//
// Расхождения допустимы ТОЛЬКО из явного списка исключений, каждое — с
// причиной-законом. Новое расхождение = красный тест, а не расширение списка.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import { createLabuiEngine, PASSPORT_FINGERPRINT } from "../engine.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const stubCssPath = join(here, "..", "..", "colors-stub", "contract.css");

/**
 * Исключения сверки — роли, где эмиссия движка НАМЕРЕННО расходится со стабом.
 * Каждая запись обязана нести закон-причину; пустеющий список — цель поезда.
 */
const EXPECTED_DIVERGENCES = new Map([
  // Сентимент-солвер смещает info от синего бренда (закон разведения оттенка);
  // стаб несёт до-законные Figma-значения.
  ["--lab-label-info-primary", "разведение оттенка с брендом"],
  ["--lab-label-info-secondary", "разведение оттенка с брендом"],
  ["--lab-label-info-tertiary", "разведение оттенка с брендом"],
  ["--lab-border-info-base", "разведение оттенка с брендом"],
  ["--lab-border-info-soft", "разведение оттенка с брендом"],
  ["--lab-border-info-strong", "разведение оттенка с брендом"],
  ["--lab-fill-info-primary", "разведение оттенка с брендом"],
  ["--lab-fill-info-secondary", "разведение оттенка с брендом"],
  ["--lab-fill-info-tertiary", "разведение оттенка с брендом"],
  ["--lab-fx-glow-info", "разведение оттенка с брендом"],
  ["--lab-fx-focus-ring-info", "разведение оттенка с брендом"],
  ["--lab-label-info-quaternary", "разведение оттенка с брендом"],
  ["--lab-fill-info-quaternary", "разведение оттенка с брендом"],
  // Лейблы и border-strong — СОЛВЕР, не статические чернила: текст обязан
  // решаться от фактического фона (LPC + WCAG-пол), статика стаба —
  // до-законный язык; солвер-солид ≈ композиту чернил в паре LSB на
  // дефолтном фоне, но адаптивен на любом.
  ["--lab-label-primary", "лейбл решается солвером от фона"],
  ["--lab-label-secondary", "лейбл решается солвером от фона"],
  ["--lab-label-tertiary", "лейбл решается солвером от фона"],
  ["--lab-label-quaternary", "лейбл решается солвером от фона"],
  ["--lab-border-strong", "сильная ступень решается солвером от фона"],
  // Figma-ошибка (заземлена): вся glow-семья @52, а FX/Glow/Inverted привязан
  // к сырому солиду Neutral/4 вместо лежащего рядом 4@52 — движок @52
  // консистентен и прав.
  ["--lab-fx-glow-inverted", "Figma-недосмотр: солид вместо @52 всей glow-семьи"],
  // Провизорный литерал стаба без engine-деривации: закрывается задачей
  // деривации (точка на растяжке по контракту), не подгонкой.
  ["--lab-fill-neutral", "PROVISIONAL стаба; деривация — открытая задача"],
  // Zero-токены: «нет цвета» by design — движок честно не эмитит невидимое,
  // стаб нёс заглушку той же семантики с α=0.
  ["--lab-fill-none", "Zero-токен: невидимость эмитится отсутствием"],
  ["--lab-border-ghost", "Zero-токен: невидимость эмитится отсутствием"],
  // Компонентная поверхность контрола (light: белая поверхность, dark:
  // fill-ступень) — производная компонентного уровня, маппится поездом.
  ["--lab-control-bg", "компонентная поверхность — маппинг поезда"],
  // Тени переезжают на lift-контракт (rgba: тёмный тинт × выведенная α) —
  // этап семантической таблицы в движке; паспорт пока несёт легаси-имена.
  ["--lab-fx-shadow-minor", "lift-контракт теней — движковый этап"],
  ["--lab-fx-shadow-ambient", "lift-контракт теней — движковый этап"],
  ["--lab-fx-shadow-penumbra", "lift-контракт теней — движковый этап"],
  ["--lab-fx-shadow-major", "lift-контракт теней — движковый этап"],
]);

/** Разобрать значения --lab-* из scope-блока стаба. Селектор ищется
 * multiline-регэкспом по началу строки: шапка-комментарий стаба упоминает те
 * же селекторы текстом, и поиск подстрокой цеплял комментарий, беря затем
 * «{» чужого блока — сверка dark читала light-значения. */
function parseScope(css, scopePattern) {
  const m = scopePattern.exec(css);
  if (!m) throw new Error(`scope не найден: ${scopePattern}`);
  const start = m.index;
  const open = css.indexOf("{", start);
  let depth = 1;
  let i = open + 1;
  while (depth > 0 && i < css.length) {
    if (css[i] === "{") depth++;
    if (css[i] === "}") depth--;
    i++;
  }
  const block = css.slice(open + 1, i - 1);
  const vars = new Map();
  for (const m of block.matchAll(/(--lab-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    vars.set(m[1], m[2].replace(/\/\*.*?\*\//g, "").trim());
  }
  return vars;
}

/** Нормализовать значение до сравнимой формы: hex → rgb(R G B), пробелы. */
function normalise(value) {
  const hex = value.match(/^#([0-9a-fA-F]{6})$/);
  if (hex) {
    const n = Number.parseInt(hex[1], 16);
    return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255})`;
  }
  // Солидные лестничные позиции граница печатает как rgb(r g b / 1) —
  // семантически тот же солид, что rgb(r g b) стаба.
  return value
    .replace(/\s*\/\s*1\)$/, ")")
    .replace(/\s+/g, " ")
    .trim();
}

describe("золотая сверка: живой движок против стаба", () => {
  /** @type {{colors: any, fingerprint: string}} */
  let engine;
  /** @type {string} */
  let stubCss;

  beforeAll(async () => {
    engine = await createLabuiEngine();
    stubCss = await readFile(stubCssPath, "utf8");
  });

  it("паспорт не дрейфанул: отпечаток равен пину", () => {
    expect(engine.fingerprint).toBe(PASSPORT_FINGERPRINT);
  });

  for (const [theme, scope, bg] of [
    ["light", /^:root,\s*\r?\n\[data-theme="light"\]\s*\{/m, "#FFFFFF"],
    ["dark", /^\[data-theme="dark"\]\s*\{/m, "#101012"],
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
        if (stubValue.startsWith("var(")) continue; // алиас-ссылки сверяются целью
        const liveValue = live.get(name);
        if (liveValue === undefined) {
          // Роль стаба, которую движок не эмитит: легальна только коллапс-зона
          // (bg-*/static/on-*/material — входы и флаги, не роли эмиссии).
          const collapsed =
            name.startsWith("--lab-bg-") ||
            name.includes("static") ||
            name.includes("-on-") ||
            name.includes("material") ||
            name.startsWith("--lab-label-inverted") ||
            name === "--lab-border-inverted" ||
            name.startsWith("--lab-badge-");
          if (!collapsed && !EXPECTED_DIVERGENCES.has(name)) stale.push(name);
          continue;
        }
        if (normalise(liveValue) !== normalise(stubValue)) {
          if (!EXPECTED_DIVERGENCES.has(name)) {
            unexpected.push(`${name}: стаб ${stubValue} != движок ${liveValue}`);
          }
        }
      }
      expect(unexpected, "нелегальные расхождения значений").toEqual([]);
      expect(stale, "роли стаба без эмиссии и без закона-исключения").toEqual([]);
    });
  }
});
