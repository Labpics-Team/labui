// Замер закона уровней ПО ФАКТИЧЕСКОЙ ЭМИССИИ contract.css — независимо от
// движка. Читает артефакт (не роли движка), резолвит каскад и var(), считает
// перцептивный тон уровня в oklab-J' (единственная labui-копия матриц —
// oklab-math.mjs). Композит translucent-оверлеев — в gamma-sRGB (source-over,
// как в CSS/Figma): проверено байт-в-байт против engine.compositeHex.
//
// НАЗНАЧЕНИЕ: питает гейт закона уровней (test/level-law.test.mjs) и таблицу
// отклонений. Тон здесь — oklab-J' (воспроизводимо из эмиссии). Паспортные
// dj-anchor цели (bg-tone) заданы в CAM16-UCS J' движка — их сверка идёт через
// engine.achievedDj (та же метрика), НЕ через этот oklab-J' (разные модели
// светлоты; oklab-J' тут — для МОНОТОННОСТИ и ОТНОСИТЕЛЬНЫХ сравнений семей).
import { gam, hexToLin, linOf, oklabOf } from './oklab-math.mjs';

/** Фоны резолва тем — паспортные якоря нейтрали (bg-tone-1). */
export const BG_ANCHOR = { light: '#FFFFFF', dark: '#101012' };

/** Вырезать тело scope-блока (тот же приём, что генератор/золото). */
function scopeBody(css, re) {
  const m = re.exec(css);
  if (!m) throw new Error(`scope не найден: ${re}`);
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

/**
 * Карта переменных scope-а: имя → значение. ПОСЛЕДНЕЕ вхождение побеждает —
 * это и есть каскад CSS (bg-* эмитятся дважды: мост, затем override тон-алиасом;
 * браузер видит последнее). Значение — между `:` и первым `;` (комментарий идёт
 * ПОСЛЕ `;`, в значение не попадает).
 */
function parseScope(body) {
  const map = new Map();
  for (const m of body.matchAll(/(--lab-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    map.set(m[1], m[2].trim());
  }
  return map;
}

/** Разобрать contract.css на scope-карты обеих тем (каскад учтён). */
export function parseScopes(css) {
  const norm = css.replace(/\r\n/g, '\n');
  return {
    light: parseScope(scopeBody(norm, /^:root,\s*\n\[data-theme="light"\]\s*\{/m)),
    dark: parseScope(scopeBody(norm, /^\[data-theme="dark"\]\s*\{/m)),
  };
}

/** Резолвить var(--x) внутри scope до литерала (циклы — падение). */
export function resolveVar(map, value, seen = 0) {
  if (seen > 16) throw new Error(`цикл var() на ${value}`);
  const m = /^var\((--lab-[a-z0-9-]+)\)$/.exec(value.trim());
  if (!m) return value.trim();
  const next = map.get(m[1]);
  if (next == null) throw new Error(`var ссылается на несуществующий ${m[1]}`);
  return resolveVar(map, next, seen + 1);
}

/** Извлечь alpha из emitted-значения (oklch/rgb); непрозрачный → 1, не цвет → null. */
export function alphaOf(map, value) {
  const v = resolveVar(map, value);
  const ok = /oklch\([^)]*\/\s*([\d.]+)\s*\)/.exec(v);
  if (ok) return Number(ok[1]);
  const rg = /rgb\([^)]*\/\s*([\d.]+)\s*\)/.exec(v);
  if (rg) return Number(rg[1]);
  if (/^oklch\(|^rgb\(|^#/.test(v)) return 1;
  return null;
}

function oklchToSrgb(L, C, H) {
  const lab = [L / 100, C * Math.cos((H * Math.PI) / 180), C * Math.sin((H * Math.PI) / 180)];
  return linOf(lab)
    .map(gam)
    .map((x) => Math.min(1, Math.max(0, x)));
}
const hexToSrgb = (h) => {
  const n = Number.parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255);
};
const srgbToHex = (s) =>
  `#${s
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`.toUpperCase();

/**
 * Финальный видимый hex значения над фоном bgHex. Непрозрачный — сам цвет;
 * translucent — source-over композит в gamma-sRGB (как CSS). Не цвет → null.
 */
export function effectiveHex(map, value, bgHex) {
  const v = resolveVar(map, value);
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toUpperCase();
  const rg = /rgb\(\s*(\d+)\s+(\d+)\s+(\d+)(?:\s*\/\s*([\d.]+))?\s*\)/.exec(v);
  if (rg) {
    const src = [+rg[1] / 255, +rg[2] / 255, +rg[3] / 255];
    const a = rg[4] != null ? +rg[4] : 1;
    if (a >= 1) return srgbToHex(src);
    const bg = hexToSrgb(bgHex);
    return srgbToHex(src.map((c, i) => a * c + (1 - a) * bg[i]));
  }
  const ok = /oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/.exec(v);
  if (!ok) return null;
  const src = oklchToSrgb(+ok[1], +ok[2], +ok[3]);
  const a = ok[4] != null ? +ok[4] : 1;
  if (a >= 1) return srgbToHex(src);
  const bg = hexToSrgb(bgHex);
  return srgbToHex(src.map((c, i) => a * c + (1 - a) * bg[i]));
}

/** oklab-светлота J' (0..100) hex-цвета. */
export const jprime = (hex) => oklabOf(hexToLin(hex))[0] * 100;

/**
 * Тон роли ПО ЭМИССИИ: J' видимой поверхности и dJ' от фона темы. Для
 * translucent — тон композита над bgHex. Не цвет/нет роли → null.
 */
export function toneOf(map, name, bgHex) {
  const raw = map.get(name);
  if (raw == null) return null;
  const hex = effectiveHex(map, raw, bgHex);
  if (!hex) return null;
  const J = jprime(hex);
  return { J, dJ: J - jprime(bgHex), hex, alpha: alphaOf(map, raw), raw: resolveVar(map, raw) };
}

// --- Структура семейств и уровней (лестницы с именованными уровнями) ---

/** Оттеночные семьи (hue-оси); нейтраль — ахроматический референс уровня. */
export const SENTIMENTS = ['brand', 'danger', 'warning', 'success', 'info'];
/** Полный набор лестничных семей (нейтраль + оттенки + статики). */
export const LADDER_FAMILIES = ['neutral', ...SENTIMENTS, 'static-dark', 'static-light'];
export const FILL_LEVELS = ['primary', 'secondary', 'tertiary', 'quaternary'];
export const LABEL_LEVELS = ['primary', 'secondary', 'tertiary', 'quaternary'];
export const BORDER_LEVELS = ['strong', 'base', 'soft'];

/** Имя переменной семьи/уровня (нейтраль — без суффикса семьи). */
export function varName(domain, family, level) {
  const fam = family === 'neutral' ? '' : `${family}-`;
  return `--lab-${domain}-${fam}${level}`;
}

/** Тон-ряд семьи по уровням (массив toneOf, null где нет роли). */
export function ladderRow(map, domain, family, levels, bgHex) {
  return levels.map((lvl) => toneOf(map, varName(domain, family, lvl), bgHex));
}
