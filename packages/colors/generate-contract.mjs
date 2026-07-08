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
 * Провизорный мост: движок эмитит приближение (для полноты словаря), но его
 * деривация ещё не установлена — потребителям публикуется Figma-якорь.
 * fill-neutral: пер-темная нейтральная поверхность (232/35), по сути ступень
 * будущей фоновой лестницы (BL-007). pair-fill(neutral) ТЕМА-ИНВАРИАНТЕН
 * (light === dark, проверено движком) — не выражает тема-отзывчивую нейтраль,
 * поэтому заливка остаётся мостом до BL-007. Её ЛЕЙБЛ (label-on-neutral) уже
 * не статика: nested-resolve label-primary на этой заливке (semanticPairOverrides).
 */
const PROVISIONAL_BRIDGE = new Set(['--lab-fill-neutral']);

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

/** rgb(r g b) → #RRGGBB (вход nested-resolve лейбла на провизорной заливке). */
function rgbToHex(rgb) {
  // Провизорные нейтрали непрозрачны; альфа тут — не тихо игнорировать, а падать:
  // композит лейбла на полупрозрачной заливке зависел бы от фона (другой класс).
  if (rgb.includes('/')) throw new Error(`ожидался непрозрачный rgb(): ${rgb}`);
  const m = rgb.match(/rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\)/);
  if (!m) throw new Error(`ожидался rgb(r g b): ${rgb}`);
  const hx = (n) => Number(n).toString(16).padStart(2, '0');
  return `#${hx(m[1])}${hx(m[2])}${hx(m[3])}`.toUpperCase();
}

/**
 * Семантический паспорт «несущих лейбл» поверхностей — ЗАКОН ПАРЫ (crate::pair),
 * тот же, что бейдж. Замороженный figma-reference.css несёт до-законные мосты
 * (fill-accent = сырой border-brand-strong 4.017:1 < 4.5; label-on-accent =
 * статический белый) — здесь они ПЕРЕКРЫВАЮТСЯ деривацией движка каскадом.
 *
 * ОДИН ИСТОЧНИК ИСТИНЫ — passport.aliases: каждый алиас на `badge-fill-<family>`
 * объявляет несущую лейбл поверхность закона пары. Из него ДЕРИВИРУЕТСЯ пара:
 *   fill-<name>     → var(badge-fill-<family>)      (заливка = pair-fill семьи),
 *   label-on-<name> → var(badge-label-on-<family>)  (парный лейбл заливки).
 * Смена таргета алиаса в паспорте тянет и заливку, и лейбл — ноль ручной
 * синхронизации, ноль дубля oklch (ссылка, а не копия; байт-в-байт с badge).
 *
 * fill-neutral остаётся провизорным мостом (pair-fill(neutral) тема-инвариантен),
 * но ЕЁ лейбл — деривация: label-primary, решённый на провизорной заливке.
 */
function semanticPairOverrides(colors, theme, anchorMap, aliases) {
  const o = new Map();
  for (const { alias, target } of aliases) {
    const family = target.match(/^badge-fill-(.+)$/)?.[1];
    if (!family) continue; // не несущая лейбл поверхность — обычный алиас
    o.set(`--lab-${alias}`, `var(--lab-${target})`);
    o.set(`--lab-${alias.replace(/^fill-/, 'label-on-')}`, `var(--lab-badge-label-on-${family})`);
  }
  const fillNeutral = anchorMap.get('--lab-fill-neutral');
  if (!fillNeutral) throw new Error('якорь не несёт --lab-fill-neutral для деривации лейбла');
  const label = colors.resolveTheme(rgbToHex(fillNeutral), theme).roles['label-primary'];
  o.set('--lab-label-on-neutral', label.css);
  return o;
}

/** Отрендерить один scope: движковые роли — живой эмиссией, прочее — мостом. */
function renderScope(anchorVars, engineVars, overrides) {
  const lines = [];
  for (const [name, anchorValue] of anchorVars) {
    if (overrides.has(name)) {
      // Закон пары: несущая лейбл поверхность / её лейбл — деривация движка,
      // перекрывает до-законный мост замороженного Figma-якоря.
      lines.push(`  ${name}: ${overrides.get(name)}; /* закон пары: деривация движка */`);
    } else if (anchorValue.startsWith('var(')) {
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

// Полный набор FX-семьи: 6 сентиментов × 3 прогрессивные ступени glow, каждый —
// свет (halo/core/α). Порядок сентиментов зеркалит канон гейта fx-family.
const FX_SENTIMENTS = ['neutral', 'brand', 'danger', 'warning', 'success', 'info'];
const GLOW_STEPS = ['base', 'subtle', 'bloom'];

/** Имя glow-переменной: base — без суффикса ступени. */
function glowVar(sentiment, step) {
  return step === 'base' ? `--lab-fx-glow-${sentiment}` : `--lab-fx-glow-${sentiment}-${step}`;
}

/**
 * Мост FX-семьи (ADR-0002 §5 «свет, не краска», волна glow поезда) — ЖИВАЯ
 * эмиссия @labpics/colors, не литералы. Движок (≥0.6) знает kind:"glow" и сам
 * решает halo/core/α ступеней (screen-солвер, бисекция под целевым |ΔJ'| на
 * фоне резолва темы) — их берём напрямую из resolveTheme().vars.
 *
 * ГЛАВНОЕ: α деградированного свечения. В светлой теме screen над белым
 * физически гаснет (|ΔJ'| = 0, role.degraded) — движок отдаёт α-сентинел 1.0,
 * который как оверлей-непрозрачность был бы неверным (сплошной halo). Контракт
 * публикует α = 0 (свет несёт border-reveal, halo/core остаются для тонировки
 * обводки) — решение выведено из ЖИВОГО флага role.degraded, а не из литерала.
 *
 * Перекрывает КАСКАДОМ базовые glow-строки renderScope (та же живая величина;
 * добавляет ступени subtle/bloom и сентименты success/info). focus-ring
 * success/info добавляются здесь же — их нет в замороженном Figma-якоре (Figma
 * их не несёт), потому renderScope их не эмитит; 4 якорных focus-ring уже
 * выведены renderScope байт-идентично, дублировать не нужно.
 * fx-glow-inverted — НЕ свечение (Translucent по дизайну), остаётся у renderScope.
 */
function fxBridgeEmission(theme, engineVars, roles, anchorNames) {
  const lines = [
    '',
    '  /* FX-семья — живая эмиссия движка (свет, не краска, ADR-0002 §5):',
    '     glow base/subtle/bloom × 6 сентиментов (halo/core/α решены screen-',
    '     солвером) + focus-ring success/info (нет в Figma-якоре). α светлой',
    '     темы = 0: screen над белым гаснет (role.degraded), свет — border-reveal. */',
  ];
  for (const s of FX_SENTIMENTS) {
    for (const step of GLOW_STEPS) {
      const v = glowVar(s, step);
      const roleKey = v.slice('--lab-'.length); // fx-glow-<s>[-<step>]
      const role = roles[roleKey];
      if (!role || role.kind !== 'glow') throw new Error(`движок не эмитит glow ${roleKey}`);
      const color = engineVars.get(v);
      const core = engineVars.get(`${v}-core`);
      if (!color || !core) throw new Error(`движок не эмитит vars для ${v}`);
      // Деградация (screen над белым гаснет) → α = 0; иначе живая α движка.
      const alpha = role.degraded ? '0' : engineVars.get(`${v}-alpha`);
      lines.push(`  ${v}: ${color};`);
      lines.push(`  ${v}-core: ${core};`);
      lines.push(`  ${v}-alpha: ${alpha};`);
    }
  }
  for (const s of FX_SENTIMENTS) {
    const v = `--lab-fx-focus-ring-${s}`;
    if (anchorNames.has(v)) continue; // якорные 4 выведены renderScope байт-идентично
    const value = engineVars.get(v);
    if (!value) throw new Error(`движок не эмитит ${v}`);
    lines.push(`  ${v}: ${value};`);
  }
  return lines.join('\n');
}

/**
 * Закон шиммера скелетона (ADR-0002 §5 «свет, не краска», волна FX-консолидации).
 *
 * ПОЧЕМУ закон, а не эмиссия движка: замороженный Figma-якорь несёт highlight =
 * mid-нейтраль при ФИКСИРОВАННОЙ α (0.039) в ОБЕИХ темах, и движок повторяет это
 * дословно. «Меньше серого оверлея = светлее» верно ТОЛЬКО над светлым фоном:
 * в light highlight (α 0.039) действительно светлее base (fill-quaternary, α 0.078).
 * В dark base тяжелее (α 0.161), и highlight при α 0.039 композитится ТЕМНЕЕ base —
 * блик светит в ОБРАТНУЮ сторону (тёмный провал вместо светлого). Заземлено
 * замером: light Δ(hl−base)=+0.031, dark Δ=−0.016 по oklab-светлоте. Это
 * Figma-недосмотр того же класса, что fx-glow-inverted (см. golden-parity).
 *
 * ЗАКОН: highlight — та же нейтраль base, доведённая до МАКСИМУМА светлоты (белый
 * анкор neutral.anchors.light, L=100% C=0) при ТОЙ ЖЕ α, что у base. Белый оверлей
 * при любом весе композитится СВЕТЛЕЕ mid-серого на ЛЮБОЙ поверхности в ОБЕИХ
 * темах (монотонность композита по светлоте оверлея) — блик гарантированно
 * светлый. Hue и α берутся ИЗ эмитированного base (лестница объективизации:
 * вывод из существующих величин системы) — ноль хардкода цвета, ноль
 * per-тема-константы. Байт-стабильность: α highlight === α base посимвольно.
 *
 * @param {string} baseSkeletonCss  значение базы-заглушки --lab-fill-quaternary (translucent oklch)
 * @returns {string} значение --lab-fx-skeleton-highlight (белый при α base)
 */
export function skeletonHighlightCss(baseSkeletonCss) {
  const m = /oklch\(\s*[\d.]+%\s+[\d.]+\s+([\d.]+)\s*\/\s*([\d.]+)\s*\)/.exec(baseSkeletonCss);
  if (!m) {
    throw new Error(
      `база скелетона (fill-quaternary) не translucent oklch(.../α): ${baseSkeletonCss}`,
    );
  }
  const [, hue, alpha] = m;
  return `oklch(100.00000% 0.000000 ${hue} / ${alpha})`;
}

/** Эмиссия шиммера: перекрывает каскадом мостовой highlight Figma-якоря. */
function skeletonShimmerEmission(engineVars) {
  // База-заглушка скелетона — Fill (fill-quaternary), не особый FX-вход (#100):
  // FX-словарь строго тени/свечения. Шиммер деривируется от fill-quaternary —
  // байт-в-байт как бывший fx-skeleton-base (та же ступень fill-лестницы).
  const baseCss = engineVars.get('--lab-fill-quaternary');
  if (!baseCss) throw new Error('движок не эмитит fill-quaternary для деривации шиммера скелетона');
  return [
    '',
    '  /* Шиммер скелетона (закон): highlight — нейтраль base (fill-quaternary) в',
    '     максимуме светлоты (белый анкор) при α base → светлее base на любой',
    '     поверхности в ОБЕИХ темах. Чинит Figma-инверсию dark-блика. */',
    `  --lab-fx-skeleton-highlight: ${skeletonHighlightCss(baseCss)};`,
  ].join('\n');
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
  const overridesLight = semanticPairOverrides(colors, 'light', new Map(light), passport.aliases);
  const overridesDark = semanticPairOverrides(colors, 'dark', new Map(dark), passport.aliases);
  const anchorLight = new Set(light.map(([name]) => name));
  const anchorDark = new Set(dark.map(([name]) => name));
  const lightBody =
    renderScope(light, engineLight, overridesLight) +
    badgePairEmission(colors, 'light', resolvedLight.roles) +
    bgLadderEmission('light', engineLight, bgLight) +
    fxBridgeEmission('light', engineLight, resolvedLight.roles, anchorLight) +
    skeletonShimmerEmission(engineLight);
  const darkBody =
    renderScope(dark, engineDark, overridesDark) +
    badgePairEmission(colors, 'dark', resolvedDark.roles) +
    bgLadderEmission('dark', engineDark, bgDark) +
    fxBridgeEmission('dark', engineDark, resolvedDark.roles, anchorDark) +
    skeletonShimmerEmission(engineDark);

  return `/*
СГЕНЕРИРОВАНО — НЕ ПРАВИТЬ РУКАМИ.
Источник: @labpics/colors@${enginePkg.version} + паспорт labui.config.json
(отпечаток ${fingerprint}). Движковые роли — живая эмиссия (единая форма
oklch); строки «закон пары: деривация движка» — несущие лейбл поверхности и их
лейблы, выведенные pair-fill (WCAG-легальны по построению); строки «мост:
Figma-якорь» — входы и компонентные поверхности из замороженного
figma-reference.css, переезжают следующими этапами поезда.
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
  console.info(`contract.css сгенерирован (${css.length} байт)`);
}
