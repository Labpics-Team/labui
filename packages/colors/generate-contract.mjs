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
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createLabuiEngine } from './engine.mjs';
import { hexToLin, oklabOf } from './oklab-math.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const referencePath = join(here, '..', 'colors-stub', 'figma-reference.css');
const contractPath = join(here, '..', 'colors-stub', 'contract.css');

/** Вырезать тело scope-блока по началу строки (тот же приём, что в золоте). */
function scopeBody(css, scopePattern) {
  const m = scopePattern.exec(css);
  if (!m) throw new Error(`scope не найден: ${scopePattern}`);
  const open = css.indexOf('{', m.index);
  let depth = 1;
  let i = open + 1;
  while (depth > 0 && i < css.length) {
    if (css[i] === '{') depth++;
    if (css[i] === '}') depth--;
    i++;
  }
  return css.slice(open + 1, i - 1);
}

/** Упорядоченный список [имя, значение] scope-а якоря (комментарии срезаются). */
function orderedVars(body) {
  // Комментарии срезаются ДО матчинга: закомментированная декларация в якоре
  // иначе протащилась бы в мост как настоящая (класс фантомных переменных).
  const clean = body.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...clean.matchAll(/(--lab-[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]);
}

/**
 * Провизорные роли: движок эмитит приближение (для полноты словаря), но его
 * деривация ещё не установлена — потребителям публикуется Figma-якорь.
 * fill-neutral: пер-темная нейтральная поверхность (232/35), по сути ступень
 * будущей фоновой лестницы (BL-007); движковый солид Neutral(Mid) одинаков в
 * обеих темах — e2e честно ловил несменяемость темы у контролов.
 */
const PROVISIONAL_BRIDGE = new Set(['--lab-fill-neutral', '--lab-label-on-neutral']);

/**
 * Пара «заливка × лейбл» бейджа — ЗАКОН ЯДРА (crate::pair, движок ≥0.5.0):
 * badge-fill-* эмитятся движком (сторона — идентичность семьи по
 * каноническому якорю, заливка сдвинута до строгой победы стороны в штатной
 * полярности), лейбл — обычный nested resolve на выведенной заливке.
 * Здесь только предвычисление лейблов для статического контракта.
 */
function badgePairEmission(colors, theme, engineRoles) {
  const families = ['brand', 'danger', 'warning', 'success', 'info', 'static-dark', 'static-light'];
  const lines = [
    '',
    '  /* Пара бейджа: заливка — закон ядра (сторона семьи + сдвиг к полу),',
    '     лейбл — nested resolve на выведенной заливке. */',
  ];
  for (const family of families) {
    const fill = engineRoles[`badge-fill-${family}`];
    if (!fill) throw new Error(`движок не эмитит badge-fill-${family}`);
    lines.push(`  --lab-badge-fill-${family}: ${fill.css};`);
    const fillHex = fill.compositeHex || fill.tintHex;
    const label = colors.resolveTheme(fillHex, theme).roles['label-primary'];
    lines.push(`  --lab-badge-label-on-${family}: ${label.css};`);
  }
  return lines.join('\n');
}

/** Отрендерить один scope: движковые роли — живой эмиссией, прочее — мостом. */
function renderScope(anchorVars, engineVars) {
  const lines = [];
  for (const [name, anchorValue] of anchorVars) {
    if (anchorValue.startsWith('var(')) {
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
  return lines.join('\n');
}

/**
 * Лестница фонов (labui ADR-0002 §1): тона — контрактные dJ'-шаги движка
 * (роли bg-tone-2/3 паспорта, значения ИЗМЕРЕНЫ по собственному Figma-якорю
 * labui: light 2.03; dark 5.78 и 9.60 от базы), маппинг ролей на тона — закон
 * асимметрии тем: светлая 2 тона × 3 применения (elevation тенями), тёмная
 * 3 тона × 2 (elevation осветлением). Объявления ПЕРЕКРЫВАЮТ мостовые строки
 * bg-* каскадом (позже в том же блоке) — это и есть переезд моста.
 */
function bgLadderEmission(theme, engineVars, bgBase) {
  const t2 = engineVars.get('--lab-bg-tone-2');
  const t3 = engineVars.get('--lab-bg-tone-3');
  if (!t2 || !t3) throw new Error('движок не эмитит bg-tone-2/3 — паспорт рассинхронизирован');
  const map =
    theme === 'light'
      ? {
          primary: '1',
          secondary: '2',
          tertiary: '1',
          'grouped-primary': '2',
          'grouped-secondary': '1',
          'grouped-tertiary': '2',
        }
      : {
          primary: '1',
          secondary: '2',
          tertiary: '3',
          'grouped-primary': '1',
          'grouped-secondary': '2',
          'grouped-tertiary': '3',
        };
  const lines = [
    '',
    "  /* Лестница фонов: тона — контрактные dJ'-шаги движка (ADR-0002 §1);",
    '     маппинг ролей на тона — асимметрия тем (2×3 light / 3×2 dark).',
    '     Переезд моста: перекрывает Figma-якорь каскадом. */',
    `  --lab-bg-tone-1: ${bgBase}; /* вход: фон резолва (паспортный якорь нейтрали) */`,
    `  --lab-bg-tone-2: ${t2};`,
    `  --lab-bg-tone-3: ${t3};`,
  ];
  for (const [role, tone] of Object.entries(map)) {
    lines.push(`  --lab-bg-${role}: var(--lab-bg-tone-${tone});`);
  }
  return lines.join('\n');
}

/** hex → oklch-строка в форме эмиссии движка (L% C h). */
function hexToOklch(hex) {
  const [l, a, b] = oklabOf(hexToLin(hex));
  const c = Math.hypot(a, b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return `oklch(${(l * 100).toFixed(5)}% ${c.toFixed(6)} ${h.toFixed(3)})`;
}

/**
 * Мост свечения (ADR-0002 §5 «свет, не краска», волна glow поезда).
 *
 * Released-движок (0.5.x) ещё не знает kind:"glow" — паспорт держит легаси
 * ladder-краску (oklch/0.522). Этот блок перекрывает её КАСКАДОМ контрактом
 * света: halo (источник), core (пересвет), α ступени Base — значения РЕШЕНЫ
 * движком ветки поезда (пример glow_mirror_derivation @ lab-colors ecbf067:
 * screen-солвер, бисекция под |ΔJ'| = 2.3006 на фоне резолва темы; ноль
 * придуманных чисел). Светлая тема: screen над белым физически гаснет
 * (деградация солвера, |ΔJ'| = 0) → α = 0, свет несёт только border-reveal
 * (halo/core остаются для тонировки обводки). При релизе 0.6.0 паспорт
 * переезжает на kind:"glow", блок заменяется живой эмиссией — байт-парность
 * гарантирует тот же пример. fx-glow-inverted — НЕ свечение (Translucent
 * по дизайну), остаётся на легаси-эмиссии.
 */
function glowBridgeEmission(theme) {
  const solved = {
    dark: {
      brand: { halo: '#4A8FFF', core: '#B3C3EA', alpha: 0.036 },
      danger: { halo: '#FF3A3A', core: '#FFA79F', alpha: 0.046 },
      warning: { halo: '#FF9008', core: '#FFC89B', alpha: 0.0333 },
      neutral: { halo: '#FFFFFF', core: '#FFFEFE', alpha: 0.0188 },
    },
    light: {
      brand: { halo: '#007AFF', core: '#A7BAE3', alpha: 0 },
      danger: { halo: '#FF3B30', core: '#FFA99E', alpha: 0 },
      warning: { halo: '#FFA100', core: '#FED1A0', alpha: 0 },
      neutral: { halo: '#FFFFFF', core: '#FFFFFE', alpha: 0 },
    },
  }[theme];
  const lines = [
    '',
    '  /* Свечение — свет, не краска (ADR-0002 §5): halo/core/α ступени Base,',
    '     решено движком поезда (glow_mirror_derivation); перекрывает легаси-',
    '     краску каскадом. Светлая тема: α = 0 — screen над белым гаснет,',
    '     свет несёт border-reveal. */',
  ];
  for (const [role, g] of Object.entries(solved)) {
    lines.push(`  --lab-fx-glow-${role}: ${hexToOklch(g.halo)};`);
    lines.push(`  --lab-fx-glow-${role}-core: ${hexToOklch(g.core)};`);
    lines.push(`  --lab-fx-glow-${role}-alpha: ${g.alpha};`);
  }
  return lines.join('\n');
}

/** Сгенерировать полный contract.css из движка и Figma-якоря. */
export async function generateContract() {
  const require = createRequire(import.meta.url);
  const enginePkgPath = join(dirname(require.resolve('@labpics/colors')), 'package.json');
  const enginePkg = JSON.parse(await readFile(enginePkgPath, 'utf8'));
  const { colors, fingerprint } = await createLabuiEngine();
  const passport = JSON.parse(await readFile(join(here, 'labui.config.json'), 'utf8'));
  // Фоны резолва тем — якоря нейтрали ПАСПОРТА, не литералы: клиентский
  // конфиг с другими опорами обязан генерировать против СВОИХ фонов.
  const bgLight = passport.neutral.anchors.light;
  const bgDark = passport.neutral.anchors.dark;
  const reference = await readFile(referencePath, 'utf8');

  const light = orderedVars(scopeBody(reference, /^:root,\s*\r?\n\[data-theme="light"\]\s*\{/m));
  const dark = orderedVars(scopeBody(reference, /^\[data-theme="dark"\]\s*\{/m));

  const engineLight = new Map(Object.entries(colors.resolveTheme(bgLight, 'light').vars));
  const engineDark = new Map(Object.entries(colors.resolveTheme(bgDark, 'dark').vars));

  const resolvedLight = colors.resolveTheme(bgLight, 'light');
  const resolvedDark = colors.resolveTheme(bgDark, 'dark');
  const lightBody =
    renderScope(light, engineLight) +
    badgePairEmission(colors, 'light', resolvedLight.roles) +
    bgLadderEmission('light', engineLight, bgLight) +
    glowBridgeEmission('light');
  const darkBody =
    renderScope(dark, engineDark) +
    badgePairEmission(colors, 'dark', resolvedDark.roles) +
    bgLadderEmission('dark', engineDark, bgDark) +
    glowBridgeEmission('dark');

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
  .split('\n')
  .map((l) => (l ? `  ${l}` : l))
  .join('\n')}
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
