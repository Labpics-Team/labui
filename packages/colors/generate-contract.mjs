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
 * Деривация лейблов бейджа — nested resolve по доктрине: лейбл решается от
 * ФАКТИЧЕСКОЙ заливки, а не ручным выбором «default/contrast» per-family
 * (ручной белый на бренде #007AFF давал 4.0:1 — ниже текстового AA 4.5;
 * солвер несёт пол по закону). Заливка семьи = border-<family>-strong
 * (солид-якорь); статики — литералы якоря.
 */
function badgeLabelDerivation(colors, theme, engineRoles, anchorMap) {
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
  const fills = [
    ["brand", hexOf("border-brand-strong")],
    ["danger", hexOf("border-danger-strong")],
    ["warning", hexOf("border-warning-strong")],
    ["success", hexOf("border-success-strong")],
    ["info", hexOf("border-info-strong")],
    ["static-dark", staticHex("--lab-border-static-dark-strong")],
    ["static-light", staticHex("--lab-border-static-light-strong")],
  ];
  const lines = [
    "",
    "  /* Деривация движком: лейбл на заливке бейджа — nested resolve от",
    "     фактической заливки (солвер + WCAG-пол), не ручной default/contrast. */",
  ];
  for (const [family, fill] of fills) {
    if (!fill) throw new Error(`badge-деривация: нет заливки семьи ${family}`);
    const nested = colors.resolveTheme(fill, theme);
    const label = nested.roles["label-primary"];
    lines.push(`  --lab-badge-label-on-${family}: ${label.css};`);
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
    badgeLabelDerivation(colors, "light", resolvedLight.roles, new Map(light));
  const darkBody =
    renderScope(dark, engineDark) +
    badgeLabelDerivation(colors, "dark", resolvedDark.roles, new Map(dark));

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
