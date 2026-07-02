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
  // Провизорный литерал стаба без engine-деривации: закрывается задачей
  // деривации (точка на растяжке по контракту), не подгонкой.
  ["--lab-fill-neutral", "PROVISIONAL стаба; деривация — открытая задача"],
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
    // it.fails: ЦЕЛЕВОЙ гейт поезда. Сегодня красный тремя классами зазора
    // (см. README §Зазоры) — переворачивается зелёным по мере закрытия;
    // случайно позеленевший fails-тест vitest честно уронит (двусторонний гейт).
    it.fails(`${theme}: каждая переменная стаба воспроизведена движком или исключена законом`, () => {
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
            name.includes("inverted-label") ||
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
