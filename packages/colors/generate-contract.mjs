// Генератор живого контракта: движок (опубликованный @labpics/colors +
// паспорт) эмитит свои роли, остальное — мост из замороженного Figma-якоря.
//
// Замена рукописной эры: contract.css перестаёт быть источником истины и
// становится АРТЕФАКТОМ движка. Независимый Figma-якорь живёт отдельно
// (colors-stub/figma-reference.css, не редактируется) — против него меряет
// золотая сверка; этот файл против движка меряет гейт регенерационной
// дисциплины (test/contract-generated.test.mjs).
//
// Регенерация: node generate-contract.mjs
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createLabuiEngine } from "./engine.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const referencePath = join(here, "..", "colors-stub", "figma-reference.css");
const contractPath = join(here, "..", "colors-stub", "contract.css");

/** Вырезать тело scope-блока по началу строки (тот же приём, что в золоте). */
function scopeBody(css, scopePattern) {
  const m = scopePattern.exec(css);
  if (!m) throw new Error(`scope не найден: ${scopePattern}`);
  const open = css.indexOf("{", m.index);
  let depth = 1;
  let i = open + 1;
  while (depth > 0 && i < css.length) {
    if (css[i] === "{") depth++;
    if (css[i] === "}") depth--;
    i++;
  }
  return css.slice(open + 1, i - 1);
}

/** Упорядоченный список [имя, значение] scope-а якоря (комментарии срезаются). */
function orderedVars(body) {
  return [...body.matchAll(/(--lab-[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [
    m[1],
    m[2].replace(/\/\*.*?\*\//g, "").trim(),
  ]);
}

/**
 * Провизорные роли: движок эмитит приближение (для полноты словаря), но его
 * деривация ещё не установлена — потребителям публикуется Figma-якорь.
 * fill-neutral: пер-темная нейтральная поверхность (232/35), по сути ступень
 * будущей фоновой лестницы (BL-007); движковый солид Neutral(Mid) одинаков в
 * обеих темах — e2e честно ловил несменяемость темы у контролов.
 */
const PROVISIONAL_BRIDGE = new Set(["--lab-fill-neutral"]);

/**
 * Пара «заливка × лейбл» бейджа — Figma-якорь + пол движением заливки.
 *
 * Полярность лейбла — ИЗМЕРЕННЫЙ якорь идентичности Figma: белый на
 * brand/danger/info (перцептивно тёмные заливки, Y ≈ 0.21–0.26 — известный
 * класс-дефект WCAG 2.x завышает чёрный на средне-хроматичных фонах; глаз и
 * Figma правы), чернила на warning/success (светлые, Y ≈ 0.42–0.47; success
 * в Figma был белым 2.22:1 — аргументированная поправка: нечитаемо, сама
 * Figma на таком же светлом warning выбрала чернила). Перцептивный
 * кроссовер в ядре — этап-2 (наука, без него данные якоря честнее закона).
 *
 * Пол: белая сторона добирает текстовый AA 4.5 МИНИМАЛЬНЫМ движением
 * заливки по светлоте Oklch (оттенок и хрома идентичности сохранены), не
 * флипом полярности — «сохранить лучшее из Figma и закон» одновременно.
 */
// Oklab-математика — те же матрицы движка (их же использует golden-сверка).
const M_OKLAB_LMS = [
  [1.0, 0.3963377774, 0.2158037573],
  [1.0, -0.1055613458, -0.0638541728],
  [1.0, -0.0894841775, -1.291485548],
];
const M_LMS_SRGB = [
  [4.0767416621, -3.3077115913, 0.2309699292],
  [-1.2684380046, 2.6097574011, -0.3413193965],
  [-0.0041960863, -0.7034186147, 1.707614701],
];
const M_SRGB_LMS = [
  [0.4122214708, 0.5363325363, 0.0514459929],
  [0.2119034982, 0.6806995451, 0.1073969566],
  [0.0883024619, 0.2817188376, 0.6299787005],
];
const M_LMS_OKLAB = [
  [0.2104542553, 0.793617785, -0.0040720468],
  [1.9779984951, -2.428592205, 0.4505937099],
  [0.0259040371, 0.7827717662, -0.808675766],
];
const mulv = (m, v) => m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const gam = (v) => (v > 0.0031308 ? 1.055 * v ** (1 / 2.4) - 0.055 : 12.92 * v);
const degam = (v) => (v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92);
const hexToLin = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => degam(c / 255));
};
const linToHex = (lin) => {
  const b = lin.map((v) => Math.min(255, Math.max(0, Math.round(gam(v) * 255))));
  return `#${b.map((x) => x.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
};
const oklabOf = (lin) => mulv(M_LMS_OKLAB, mulv(M_SRGB_LMS, lin).map(Math.cbrt));
const linOf = (lab) => mulv(M_LMS_SRGB, mulv(M_OKLAB_LMS, lab).map((x) => x ** 3));
const wcagY = (lin) => 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
const ratioVsWhite = (lin) => 1.05 / (wcagY(lin) + 0.05);

/** Минимально утемнить солид по L Oklab (оттенок/хрома целы) до пола vs белый. */
function nudgeFillToFloor(hex, floor = 4.5) {
  let lin = hexToLin(hex);
  if (ratioVsWhite(lin) >= floor) return hex;
  const [L0, a, b] = oklabOf(lin);
  let lo = 0;
  let hi = L0;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (ratioVsWhite(linOf([mid, a, b])) >= floor) lo = mid;
    else hi = mid;
  }
  return linToHex(linOf([lo, a, b]));
}

function badgePairDerivation(engineRoles, anchorMap) {
  const hexOf = (roleName) => {
    const r = engineRoles[roleName];
    return r && (r.compositeHex || r.tintHex || r.hex);
  };
  const staticHex = (name) => {
    const v = anchorMap.get(name) || "";
    const m = v.match(/rgb\((\d+) (\d+) (\d+)\)/);
    if (!m) return undefined;
    const b = (x) => Number(x).toString(16).padStart(2, "0");
    return `#${b(m[1])}${b(m[2])}${b(m[3])}`.toUpperCase();
  };
  // Полярность — Figma-якорь идентичности; success — аргументированная поправка.
  const families = [
    ["brand", hexOf("border-brand-strong"), "white"],
    ["danger", hexOf("border-danger-strong"), "white"],
    ["warning", hexOf("border-warning-strong"), "ink"],
    ["success", hexOf("border-success-strong"), "ink"],
    ["info", hexOf("border-info-strong"), "white"],
    ["static-dark", staticHex("--lab-border-static-dark-strong"), "white"],
    ["static-light", staticHex("--lab-border-static-light-strong"), "ink"],
  ];
  const lines = [
    "",
    "  /* Пара бейджа: полярность лейбла — Figma-якорь (белый на тёмных",
    "     заливках, чернила на светлых); белая сторона добирает AA 4.5",
    "     минимальным утемнением заливки (оттенок/хрома целы). */",
  ];
  for (const [family, fill, side] of families) {
    if (!fill) throw new Error(`badge-пара: нет заливки семьи ${family}`);
    const finalFill = side === "white" ? nudgeFillToFloor(fill) : fill;
    lines.push(`  --lab-badge-fill-${family}: ${finalFill};`);
    lines.push(
      `  --lab-badge-label-on-${family}: var(--lab-label-static-${side === "white" ? "light" : "dark"}-primary);`,
    );
  }
  return lines.join("\n");
}

/** Отрендерить один scope: движковые роли — живой эмиссией, прочее — мостом. */
function renderScope(anchorVars, engineVars) {
  const lines = [];
  for (const [name, anchorValue] of anchorVars) {
    if (anchorValue.startsWith("var(")) {
      // Ссылка-алиас: одна истина — связь, не копия значения.
      lines.push(`  ${name}: ${anchorValue};`);
    } else if (PROVISIONAL_BRIDGE.has(name)) {
      lines.push(`  ${name}: ${anchorValue}; /* мост: провизорная, деривация открыта */`);
    } else if (engineVars.has(name)) {
      lines.push(`  ${name}: ${engineVars.get(name)};`);
    } else {
      // Мост: входы (bg-*), статики, материалы и компонентные поверхности —
      // дословно из Figma-якоря, переезжают следующими этапами поезда.
      lines.push(`  ${name}: ${anchorValue}; /* мост: Figma-якорь */`);
    }
  }
  return lines.join("\n");
}

/** Сгенерировать полный contract.css из движка и Figma-якоря. */
export async function generateContract() {
  const require = createRequire(import.meta.url);
  const enginePkgPath = join(
    dirname(require.resolve("@labpics/colors")),
    "package.json",
  );
  const enginePkg = JSON.parse(await readFile(enginePkgPath, "utf8"));
  const { colors, fingerprint } = await createLabuiEngine();
  const reference = await readFile(referencePath, "utf8");

  const light = orderedVars(
    scopeBody(reference, /^:root,\s*\r?\n\[data-theme="light"\]\s*\{/m),
  );
  const dark = orderedVars(scopeBody(reference, /^\[data-theme="dark"\]\s*\{/m));

  const engineLight = new Map(
    Object.entries(colors.resolveTheme("#FFFFFF", "light").vars),
  );
  const engineDark = new Map(
    Object.entries(colors.resolveTheme("#101012", "dark").vars),
  );

  const resolvedLight = colors.resolveTheme("#FFFFFF", "light");
  const resolvedDark = colors.resolveTheme("#101012", "dark");
  const lightBody =
    renderScope(light, engineLight) +
    badgePairDerivation(resolvedLight.roles, new Map(light));
  const darkBody =
    renderScope(dark, engineDark) +
    badgePairDerivation(resolvedDark.roles, new Map(dark));

  return `/*
СГЕНЕРИРОВАНО — НЕ ПРАВИТЬ РУКАМИ.
Источник: @labpics/colors@${enginePkg.version} + паспорт labui.config.json
(отпечаток ${fingerprint}). Движковые роли — живая эмиссия (единая форма
oklch); строки «мост: Figma-якорь» — входы и компонентные поверхности из
замороженного figma-reference.css, переезжают следующими этапами поезда.
Регенерация: node packages/colors/generate-contract.mjs
Гейт дисциплины: packages/colors/test/contract-generated.test.mjs
*/

:root,
[data-theme="light"] {
${lightBody}
}

[data-theme="dark"] {
${darkBody}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]):not([data-theme="dark"]) {
${darkBody
  .split("\n")
  .map((l) => (l ? `  ${l}` : l))
  .join("\n")}
  }
}
`;
}

// Прямой запуск — записать файл.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const css = await generateContract();
  await writeFile(contractPath, css);
  console.log(`contract.css сгенерирован (${css.length} байт)`);
}
