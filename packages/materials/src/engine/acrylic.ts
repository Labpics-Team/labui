/*
 * Acrylic v2 — движок luminosity-рецепта (ADR-0009).
 *
 * АНАТОМИЯ — СВОЯ, не производная стекла. Acrylic — это РАССЕЯНИЕ (диффузный
 * блюр) + luminosity-ЗАЖИМ яркости фона + зерно: физика Fluent-акрила. Стекло
 * (liquid-glass) — это РЕФРАКЦИЯ (линза feDisplacementMap гнёт фон) + карта
 * смещения по геометрии: другая физика. У acrylic НЕТ линзы, карты смещения,
 * depth/dispersion; у стекла НЕТ зажима яркости, зерна, tier-flood. Общего в
 * ЭФФЕКТЕ — ноль; см. ниже про то, что РАЗДЕЛЯЕТСЯ (только механика).
 *
 * ПОЧЕМУ движок, а не CSS: полная анатомия Fluent-акрила требует смеси с
 * размытым фоном, а CSS-слоям она недоступна физически — mix-blend-mode
 * ребёнка не достаёт до backdrop-фона (backdrop-filter создаёт stacking
 * context; доказано пиксельной пробой, память css-backdrop-blend-facts).
 * Единственный работающий путь — вся цепочка ВНУТРИ самого фильтра:
 *
 *   backdrop-filter: url(#lab-acrylic-<uid>)
 *     feGaussianBlur(48) → feColorMatrix saturate(1.8)
 *       → feFlood(тинт tier, opacity Λ) → feBlend mode="luminosity"
 *
 * Один конвейер композитора, ноль лишних слоёв, ноль JS в кадре: JS работает
 * только на attach / resize / detach.
 *
 * ── Что РАЗДЕЛЯЕТСЯ со стеклом: только МЕХАНИКА, не эффект ────────────────────
 * Оба движка — это SVG-фильтр по `url(#id)` на поверхности, поэтому у них
 * ОДИНАКОВА инженерия того, КАК фильтр живёт в DOM: `filterUnits="userSpaceOnUse"`
 * с регионом по реальному боксу, registry WeakMap + uid, ResizeObserver,
 * скрытый defs-хост, capability-проба. Это общая механика ЛЮБОГО backdrop-
 * фильтра (вынесена в ./mount), а не заимствование рецепта. САМ рецепт
 * (blur→saturate→flood→blend luminosity) и его параметры — целиком acrylic.
 *
 * ── Регион (ADR-0009 v2.1) ───────────────────────────────────────────────────
 * `userSpaceOnUse` по боксу + изотропный охват `ACRYLIC_REACH_PX = 2σ` (см. ниже).
 * Чинит КЛАСС-дефект прежнего процентного региона (`objectBoundingBox
 * −25%/150%`): процент давал РАЗНЫЙ охват по осям, и короткая ось вытянутой
 * поверхности (навбар 1500×72 → 18px по Y против нужного охвата ~σ) недобирала
 * фон за кромкой — видимый резкий кант. Абсолютный охват изотропен и честен на
 * любой форме; 2σ вместо процента даёт ~1.6× меньше пикселей блюра на больших
 * поверхностях (где GPU-лаг заметен) — деталь в комментарии ACRYLIC_REACH_PX.
 *
 * ── Слои и цвет ─────────────────────────────────────────────────────────────
 * Фильтр НЕ вносит собственного цвета: flood-color — это
 * `var(--lab-bg-material-<tier>-01)` (CSS-презентационное свойство на feFlood),
 * тот же контрактный тинт, что красит поверхность. Тема ребиндит токен на :root
 * → flood живо следует теме без JS. Смена tier-класса → refresh перечитывает
 * tier и обновляет flood-color. Сила зажима αf = альфа токена ×
 * ACRYLIC_LUMINOSITY_OPACITY (деривация; вывод коридора — acrylic-corridor.ts).
 *
 * ── Пространство счёта ──────────────────────────────────────────────────────
 * color-interpolation-filters="sRGB": смесь считает на гамма-кодированных
 * каналах — в том же пространстве, что CSS-смеси и весь compositeOver-стек
 * (SVG-дефолт linearRGB дал бы другие байты — факт пробы).
 *
 * ── Гейт и честные деградации ───────────────────────────────────────────────
 * Требование — браузерная способность рисовать url()-фильтр на backdrop
 * (`supportsBackdropFilterUrl` из ./mount, общая capability; НЕ импорт из
 * glass-модуля — acrylic от него не зависит). Инлайновый стиль сильнее
 * @media-деградаций листа, поэтому движок гаснет сам: ACRYLIC_ENGINE_MEDIA
 * перечисляет запрещающие медиа (reduced-transparency / forced-colors /
 * contrast:more); рантайм не даёт attach под ними и пере-синкается на их change.
 */

import { ACRYLIC_LUMINOSITY_OPACITY } from '../acrylic-corridor';
import { MATERIAL_TIERS, type MaterialTier } from '../material-guarantee';
import {
  type EngineHandle,
  createHiddenDefs,
  supportsBackdropFilterUrl,
  trailingRaf,
} from './mount';

const SVGNS = 'http://www.w3.org/2000/svg';
const DEFS_CLASS = 'lab-acrylic-defs';
const registry = new WeakMap<Element, EngineHandle>();
let uid = 0;

/** Радиус блюра конвейера = ступень `--_blur-live` из material.css (Figma
 *  BG-blur Base). Литерал: примитив фильтра — SVG-атрибут (var() недоступен);
 *  дрейф ловит engine-css-contract.test («один рычаг»). */
export const ACRYLIC_BLUR_PX = 48;

/** Насыщение конвейера = `--_saturate-on: 180%` из material.css (тот же замок). */
export const ACRYLIC_SATURATE = 1.8;

/** Изотропный охват региона фильтра за кромкой бокса, px = 2σ (95.4% энергии
 *  гаусса — стандартная инженерная обрезка; хвост >2σ перцептивно неотличим).
 *  Абсолютный, а не процент: процент давал недобор по короткой оси вытянутых.
 *  2σ, а не 3σ — компромисс перф/качество: площадь региона = число пикселей,
 *  которое слабый GPU (телефон) блюрит каждый кадр, и на БОЛЬШИХ поверхностях
 *  (фуллскрин-дровер, сайдбар — где лаг заметен) 2σ-охват даёт ~1.6× меньше
 *  пикселей, чем прежний процентный регион (замер — bench/BASELINE.md). */
export const ACRYLIC_REACH_PX = 2 * ACRYLIC_BLUR_PX;

/** Медиа-режимы, в которых движок обязан НЕ держать поверхность (инлайн сильнее
 *  листовых деградаций — гаснем в JS, лист остаётся бэкстопом v1). */
export const ACRYLIC_ENGINE_MEDIA = [
  '(prefers-reduced-transparency: reduce)',
  '(forced-colors: active)',
  '(prefers-contrast: more)',
] as const;

/** Способность рисовать url()-фильтр на backdrop (общая проба ./mount) — то же
 *  браузерное требование, что у стекла, но НЕ через glass-модуль: acrylic от
 *  него не зависит (у них общая браузерная способность, не общий эффект). */
export function supportsAcrylicChain(): boolean {
  return supportsBackdropFilterUrl();
}

/** true, когда хотя бы один запрещающий медиа-режим активен. */
export function acrylicMediaBlocked(): boolean {
  if (typeof matchMedia === 'undefined') return false;
  return ACRYLIC_ENGINE_MEDIA.some((query) => matchMedia(query).matches);
}

/** Tier поверхности из её классов; без модификатора — base (как в CSS). */
function tierOf(el: HTMLElement): MaterialTier {
  for (const tier of MATERIAL_TIERS) {
    if (tier !== 'base' && el.classList.contains(`lab-material--${tier}`)) return tier;
  }
  return 'base';
}

/** Собрать фильтр в локальных defs; вернуть его id и живой feFlood
 *  (flood-color пере-биндится на смену tier). Регион ставит caller (зависит
 *  от размера). */
function buildFilter(
  el: HTMLElement,
  tier: MaterialTier,
): {
  id: string;
  svg: SVGSVGElement;
  filter: SVGFilterElement;
  flood: SVGFEFloodElement;
  restore(): void;
} {
  const id = `lab-acrylic-${++uid}`;
  const document = el.ownerDocument;
  const filter = document.createElementNS(SVGNS, 'filter');
  filter.setAttribute('id', id);
  filter.setAttribute('filterUnits', 'userSpaceOnUse');
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
  flood.style.setProperty('flood-color', `var(--lab-bg-material-${tier}-01)`);

  const blend = document.createElementNS(SVGNS, 'feBlend');
  blend.setAttribute('in', 'f');
  blend.setAttribute('in2', 's');
  blend.setAttribute('mode', 'luminosity');

  filter.append(blur, saturate, flood, blend);
  const { svg, defs, restore } = createHiddenDefs(el, DEFS_CLASS);
  defs.appendChild(filter);
  return { id, svg, filter, flood, restore };
}

/** Регион = бокс элемента (border-box CSS px, без transform-масштаба —
 *  offsetWidth/Height) + изотропный охват со всех сторон. */
function setRegion(filter: SVGFilterElement, el: HTMLElement): void {
  const m = ACRYLIC_REACH_PX;
  filter.setAttribute('x', String(-m));
  filter.setAttribute('y', String(-m));
  filter.setAttribute('width', String(el.offsetWidth + 2 * m));
  filter.setAttribute('height', String(el.offsetHeight + 2 * m));
}

function writeBackdrop(el: HTMLElement, id: string): void {
  const value = `url(#${id})`;
  el.style.setProperty('backdrop-filter', value);
  el.style.setProperty('-webkit-backdrop-filter', value);
}

/**
 * Прицепить acrylic-конвейер к поверхности. Package-internal: единственный
 * caller — декларативный рантайм (runtime.ts) через binding. Механика per-
 * surface фильтра (локальные defs, регион по боксу через ResizeObserver, tier из
 * классов) — общая инженерия backdrop-фильтров (./mount), рецепт внутри — свой.
 * Attach решений о гейте/медиа не дублирует — их принимает рантайм.
 */
export function attach(el: HTMLElement): EngineHandle {
  registry.get(el)?.destroy();
  let disposed = false;
  const baseline = ['backdrop-filter', '-webkit-backdrop-filter'].map((property) => ({
    property,
    value: el.style.getPropertyValue(property),
    priority: el.style.getPropertyPriority(property),
  }));

  let tier = tierOf(el);
  const { id, svg, filter, flood, restore } = buildFilter(el, tier);
  setRegion(filter, el);
  writeBackdrop(el, id);

  // Регион зависит от размера — держим его в синхроне с боксом. Trailing-rAF
  // сворачивает шторм ресайза в один пере-расчёт (общий примитив mount.ts).
  const raf = trailingRaf(() => {
    if (!disposed) setRegion(filter, el);
  });
  const ro = new ResizeObserver(() => {
    if (!disposed) raf.schedule();
  });
  ro.observe(el);

  const handle: EngineHandle = {
    restore(): void {
      if (!disposed) restore();
    },
    refresh(): void {
      if (disposed) return;
      const now = tierOf(el);
      if (now !== tier) {
        tier = now;
        // Только flood-color зависит от tier; регион и цепочка — нет.
        flood.style.setProperty('flood-color', `var(--lab-bg-material-${tier}-01)`);
      }
    },
    destroy(): void {
      if (disposed) return;
      disposed = true;
      ro.disconnect();
      raf.cancel();
      svg.remove();
      for (const { property, value, priority } of baseline) {
        el.style.setProperty(property, value, priority);
      }
      if (registry.get(el) === handle) registry.delete(el);
    },
  };

  registry.set(el, handle);
  return handle;
}
