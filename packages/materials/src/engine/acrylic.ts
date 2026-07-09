/*
 * Acrylic v2 — движок luminosity-рецепта (ADR-0009).
 *
 * ПОЧЕМУ движок, а не CSS: полная анатомия Fluent-акрила требует смеси с
 * размытым фоном, а CSS-слоям она недоступна физически — mix-blend-mode
 * ребёнка не достаёт до backdrop-фона (backdrop-filter создаёт stacking
 * context; доказано пиксельной пробой, память css-backdrop-blend-facts).
 * Единственный работающий путь — вся цепочка ВНУТРИ самого фильтра:
 *
 *   backdrop-filter: url(#lab-acrylic-<tier>)
 *     feGaussianBlur(48) → feColorMatrix saturate(1.8)
 *       → feFlood(тинт tier, opacity Λ) → feBlend mode="luminosity"
 *
 * Один конвейер композитора, ноль лишних слоёв, ноль JS в кадре: JS работает
 * только на attach/detach (пишет инлайновую пару backdrop-filter, как LG).
 *
 * ── Слои и цвет ─────────────────────────────────────────────────────────────
 * Фильтр НЕ вносит собственного цвета: flood-color каждого tier-фильтра — это
 * `var(--lab-bg-material-<tier>-01)` (CSS-презентационное свойство на feFlood),
 * тот же контрактный тинт, что красит поверхность. Тема ребиндит токен на
 * :root → flood живо следует теме без JS. Сила зажима αf = альфа токена ×
 * ACRYLIC_LUMINOSITY_OPACITY — прозрачный tier зажимает слабее сам собой
 * (деривация, ноль новых значений; вывод коридора — src/acrylic-corridor.ts).
 *
 * ── Пространство счёта ──────────────────────────────────────────────────────
 * color-interpolation-filters="sRGB" на фильтре: смесь считает на гамма-
 * кодированных каналах — в том же пространстве, что CSS-смеси и весь
 * compositeOver-стек пакета (иначе SVG-дефолт linearRGB разошёлся бы с
 * выводом коридора; факт пробы: linearRGB даёт другие байты).
 *
 * ── Гейт и честные деградации ───────────────────────────────────────────────
 * Требование то же, что у рефракции LG: url()-фильтр, реально РИСУЮЩИЙ на
 * backdrop (только Chromium; Safari/Firefox парсят синтаксис, но не рендерят)
 * — поэтому гейт ПЕРЕИСПОЛЬЗУЕТ supportsRefraction() из liquid-glass.ts.
 * Инлайновый стиль сильнее @media-деградаций листа, поэтому движок обязан
 * гаснуть сам: ACRYLIC_ENGINE_MEDIA перечисляет запрещающие медиа-запросы
 * (reduced-transparency / forced-colors / contrast:more), рантайм не даёт
 * attach под ними и пере-синкается на их change. Известный зазор LG (инлайн
 * линзы переживает forced-colors) здесь закрыт с рождения.
 */

import { ACRYLIC_LUMINOSITY_OPACITY } from '../acrylic-corridor';
import { MATERIAL_TIERS, type MaterialTier } from '../material-guarantee';
import { supportsRefraction } from './liquid-glass';

const SVGNS = 'http://www.w3.org/2000/svg';

/**
 * Радиус блюра конвейера = ступень `--_blur-live` из material.css (Figma
 * BG-blur Base). Литерал здесь, потому что примитив фильтра — SVG-атрибут
 * (var() недоступен); дрейф ловит engine-css-contract.test («один рычаг»).
 */
export const ACRYLIC_BLUR_PX = 48;

/** Насыщение конвейера = `--_saturate-on: 180%` из material.css (тот же замок). */
export const ACRYLIC_SATURATE = 1.8;

/** Медиа-режимы, в которых движок обязан НЕ держать поверхность (инлайн
 *  сильнее листовых деградаций — гаснем в JS, лист остаётся бэкстопом v1). */
export const ACRYLIC_ENGINE_MEDIA = [
  '(prefers-reduced-transparency: reduce)',
  '(forced-colors: active)',
  '(prefers-contrast: more)',
] as const;

/** Тот же гейт, что у рефракции: url()-фильтр, рисующий на backdrop. */
export function supportsAcrylicChain(): boolean {
  return supportsRefraction();
}

/** true, когда хотя бы один запрещающий медиа-режим активен. */
export function acrylicMediaBlocked(): boolean {
  if (typeof matchMedia === 'undefined') return false;
  return ACRYLIC_ENGINE_MEDIA.some((query) => matchMedia(query).matches);
}

export interface AcrylicHandle {
  /** Перечитать tier с элемента (смена класса) и обновить инлайн при смене. */
  refresh(): void;
  /** Снять инлайновую пару — лист (v1-фолбэк) снова владеет поверхностью. */
  destroy(): void;
}

let defsHost: SVGSVGElement | null = null;

function filterId(tier: MaterialTier): string {
  return `lab-acrylic-${tier}`;
}

/**
 * Пять статичных tier-фильтров в одном скрытом <svg> (паттерн ensureDefs LG).
 * Строятся один раз на документ; flood-color каждого — живой var() контракта,
 * поэтому ни тема, ни поезд colors не требуют пересборки.
 */
function ensureAcrylicDefs(): void {
  if (defsHost?.isConnected) return;
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'lab-acrylic-defs');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  for (const tier of MATERIAL_TIERS) {
    const filter = document.createElementNS(SVGNS, 'filter');
    filter.setAttribute('id', filterId(tier));
    // Регион шире бокса поверхности: даёт блюру честную выборку фона за
    // кромкой (без виньетки края). 25% ≈ ядро гаусса σ=48 для типовых панелей;
    // хвост дальше 1.5σ перцептивно пуст — DECLARED-размен в ADR-0009.
    filter.setAttribute('x', '-25%');
    filter.setAttribute('y', '-25%');
    filter.setAttribute('width', '150%');
    filter.setAttribute('height', '150%');
    filter.setAttribute('color-interpolation-filters', 'sRGB');

    const blur = document.createElementNS(SVGNS, 'feGaussianBlur');
    blur.setAttribute('stdDeviation', String(ACRYLIC_BLUR_PX));
    blur.setAttribute('result', 'b');

    const saturate = document.createElementNS(SVGNS, 'feColorMatrix');
    saturate.setAttribute('in', 'b');
    saturate.setAttribute('type', 'saturate');
    saturate.setAttribute('values', String(ACRYLIC_SATURATE));
    saturate.setAttribute('result', 's');

    const flood = document.createElementNS(SVGNS, 'feFlood');
    flood.setAttribute('flood-opacity', String(ACRYLIC_LUMINOSITY_OPACITY));
    flood.setAttribute('result', 'f');
    // flood-color — CSS-презентационное свойство: живой var() контракта.
    flood.style.setProperty('flood-color', `var(--lab-bg-material-${tier}-01)`);

    const blend = document.createElementNS(SVGNS, 'feBlend');
    blend.setAttribute('in', 'f');
    blend.setAttribute('in2', 's');
    blend.setAttribute('mode', 'luminosity');

    filter.append(blur, saturate, flood, blend);
    svg.appendChild(filter);
  }
  document.body.appendChild(svg);
  defsHost = svg;
}

/** Tier поверхности из её классов; без модификатора — base (как в CSS). */
function tierOf(el: HTMLElement): MaterialTier {
  for (const tier of MATERIAL_TIERS) {
    if (tier !== 'base' && el.classList.contains(`lab-material--${tier}`)) return tier;
  }
  return 'base';
}

function writeChain(el: HTMLElement, tier: MaterialTier): void {
  const value = `url(#${filterId(tier)})`;
  el.style.setProperty('backdrop-filter', value);
  el.style.setProperty('-webkit-backdrop-filter', value);
}

/**
 * Держать поверхность на v2-конвейере. Вызывается рантаймом (runtime.ts) —
 * только под acrylic-скоупом, только при supportsAcrylicChain() и только вне
 * ACRYLIC_ENGINE_MEDIA; сам attach этих решений не дублирует (SRP: решает
 * рантайм-скан, движок исполняет).
 */
export function attach(el: HTMLElement): AcrylicHandle {
  ensureAcrylicDefs();
  let held = tierOf(el);
  writeChain(el, held);

  return {
    refresh(): void {
      const now = tierOf(el);
      if (now !== held) {
        held = now;
        writeChain(el, held);
      }
    },
    destroy(): void {
      el.style.removeProperty('backdrop-filter');
      el.style.removeProperty('-webkit-backdrop-filter');
    },
  };
}
