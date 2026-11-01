/*
 * Общий движковый примитив — оркестрация декларативного рантайма материалов.
 *
 * Три движка (liquid-glass, acrylic, veil) делят ОДНУ механику монтирования:
 * просканировать scope, собрать множество поверхностей, которые движок хочет
 * держать, отцепить ушедшие, прицепить новых, обновить удержанные. До этого
 * файла она жила ТРЕМЯ почти дословными копиями в runtime.ts (DRY-долг).
 *
 * Clean Architecture: рантайм зависит от АБСТРАКЦИИ `EngineBinding`, а не от
 * конкретных движков — этот модуль про них ничего не знает. Каждый движок
 * поставляет свой binding (gate + selector + wants + attach); `mountEngine`
 * исполняет единую механику. SOLID/OCP: новый движок = новый binding в массиве
 * рантайма, `mountEngine` НЕ трогается.
 */

const SVGNS = 'http://www.w3.org/2000/svg';

/*
 * Браузерная СПОСОБНОСТЬ рисовать SVG-фильтр по `url(#id)` на backdrop —
 * общая capability-проба, не про КОНКРЕТНЫЙ эффект. Firefox и Safari ПАРСЯТ
 * `backdrop-filter: url(#f)` (CSS.supports=true), но НЕ рендерят SVG-фильтр на
 * backdrop — только Chromium. Оба движка, которым нужен url()-фильтр на
 * backdrop (рефракция liquid-glass И luminosity-конвейер acrylic — РАЗНЫЕ
 * эффекты, ОДНА браузерная способность), гейтятся ею. Ответ не меняется в
 * пределах страницы → пробуется один раз. Живёт здесь (общий низ), чтобы
 * acrylic НЕ зависел от glass-модуля ради этой пробы.
 */
interface UaDataBrand {
  brand: string;
}
let backdropUrlProbe: boolean | null = null;
export function supportsBackdropFilterUrl(): boolean {
  if (backdropUrlProbe === null) backdropUrlProbe = probeBackdropFilterUrl();
  return backdropUrlProbe;
}
function probeBackdropFilterUrl(): boolean {
  if (typeof CSS === 'undefined' || !CSS.supports) return false;
  if (
    !CSS.supports('backdrop-filter', 'url(#x)') &&
    !CSS.supports('-webkit-backdrop-filter', 'url(#x)')
  ) {
    return false;
  }
  const uaData =
    typeof navigator !== 'undefined'
      ? (navigator as Navigator & { userAgentData?: { brands?: UaDataBrand[] } }).userAgentData
      : null;
  if (uaData && Array.isArray(uaData.brands)) {
    return uaData.brands.some((b) => /Chromium/i.test(b.brand));
  }
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return /Chrome|Chromium|Edg|OPR/.test(ua) && !/Firefox|FxiOS/.test(ua);
}

/**
 * Хост принадлежит одному handle. Внутри surface SVG сохраняет её tree scope
 * для url(#id) и наследует локальные CSS-токены. Handle удаляет хост целиком.
 */
export function createHiddenDefs(
  surface: HTMLElement,
  className: string,
): { svg: SVGSVGElement; defs: SVGDefsElement } {
  const document = surface.ownerDocument;
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', className);
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  const defs = document.createElementNS(SVGNS, 'defs');
  svg.appendChild(defs);
  surface.appendChild(svg);
  return { svg, defs };
}

/**
 * Trailing-edge rAF: сворачивает бурю вызовов (ResizeObserver под настройкой
 * лейаута, hydration) в ОДИН запуск на следующем кадре — финальное состояние
 * тождественно недебаунсенному прогону, лишние промежуточные пропущены. Тот же
 * приём, что движки применяют к штормам ресайза; здесь — один раз, без копий.
 */
export function trailingRaf(fn: () => void): { schedule(): void; cancel(): void } {
  let rafId = 0;
  return {
    schedule(): void {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        fn();
      });
    },
    cancel(): void {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    },
  };
}

/** Живёт, пока движок держит поверхность. `refresh` опционален — движок без
 *  живого пере-чтения (liquid-glass в рантайме) его не несёт. */
export interface EngineHandle {
  refresh?(): void;
  destroy(): void;
}

/**
 * Контракт одного движка для рантайма. Порт (Clean Arch): `mountEngine` знает
 * ТОЛЬКО его, не конкретные движки.
 */
export interface EngineBinding {
  /** Поддержан ли движок в этом окружении (пробуется один раз рантаймом). */
  gate(): boolean;
  /** CSS-селектор поверхностей движка (`.lab-material` / `[data-veil]`). */
  readonly selector: string;
  /** Активировать ли эффект (ближайший скоуп мода / всегда для veil). */
  wants(el: HTMLElement): boolean;
  /** Медиа-режим временно запрещает движок (acrylic под reduced-transparency
   *  и т.п.: инлайн сильнее листовых деградаций, поэтому движок гаснет сам). */
  blocked?(): boolean;
  /** Медиа-запросы, чья смена требует пере-синка (регистрируются рантаймом). */
  readonly mediaQueries?: readonly string[];
  /** Звать ли `handle.refresh()` на удержанной поверхности при ре-синке.
   *  Сохраняет ТОЧНОЕ per-движок поведение: veil/acrylic перечитывают tier/
   *  конфиг, liquid-glass в рантайме — нет (его ре-рендер вне этой петли). */
  readonly refreshHeld: boolean;
  /** Прицепить движок к поверхности; вернуть её хэндл. */
  attach(el: HTMLElement): EngineHandle;
}

/** Смонтированный движок: одна sync-функция + утилизатор. */
export interface MountedEngine {
  sync(): void;
  dispose(): void;
  readonly mediaQueries: readonly string[];
}

interface SharedHandle {
  handle: EngineHandle | undefined;
  users: number;
}

// App и локальный mount держат один ресурс на пару (поверхность, binding).
// Scope хранит владение, а не конкретный engine handle. При временном отзыве
// ресурса живые владельцы сохраняются: reconnect не требует события внутри root.
const surfaces = new WeakMap<HTMLElement, Map<EngineBinding, SharedHandle>>();

function reconcileSurface(el: HTMLElement): void {
  const effects = surfaces.get(el);
  if (!effects) return;
  for (const [binding, shared] of effects) {
    if (
      !el.isConnected ||
      !el.matches(binding.selector) ||
      !binding.wants(el) ||
      binding.blocked?.()
    ) {
      // Сначала отозвать прежний материал, затем разрешить attach следующего.
      // Veil остаётся, пока его собственный binding применим.
      const handle = shared.handle;
      shared.handle = undefined;
      handle?.destroy();
    }
  }
}

function release(binding: EngineBinding, el: HTMLElement, shared: SharedHandle): void {
  const effects = surfaces.get(el);
  if (effects?.get(binding) !== shared) return;
  if (--shared.users !== 0) return;
  effects.delete(binding);
  if (effects.size === 0) surfaces.delete(el);
  const handle = shared.handle;
  shared.handle = undefined;
  handle?.destroy();
}

/**
 * Единая механика монтирования одного движка над `scope`. Заменяет три
 * дословных блока runtime.ts. `sync` идемпотентна: держит ровно те поверхности,
 * что соответствуют selector, отцепляя ушедшие. Mode/connection/media гейтят
 * ресурс, а не владение: queued sync отключённого scope сохраняет его leases.
 */
export function mountEngine(binding: EngineBinding, scope: Document | Element): MountedEngine {
  const held = new Map<HTMLElement, SharedHandle>();
  let disposed = false;

  const sync = (): void => {
    if (disposed) return;
    const want = new Set<HTMLElement>();
    for (const el of scope.querySelectorAll(binding.selector)) {
      if (el instanceof HTMLElement) want.add(el);
    }
    if (scope instanceof HTMLElement && scope.matches(binding.selector)) {
      want.add(scope);
    }
    for (const el of new Set([...held.keys(), ...want])) reconcileSurface(el);
    // Отцепить вышедших из scope или переставших соответствовать selector.
    for (const [el, shared] of held) {
      if (!want.has(el) || surfaces.get(el)?.get(binding) !== shared) {
        release(binding, el, shared);
        held.delete(el);
      }
    }
    // Прицепить новичков ровно один раз; удержанных — обновить (если движок так
    // хочет), сохраняя его точное поведение.
    for (const el of want) {
      let shared = held.get(el);
      if (!shared) {
        let effects = surfaces.get(el);
        if (!effects) {
          effects = new Map();
          surfaces.set(el, effects);
        }
        shared = effects.get(binding);
        if (shared) {
          shared.users++;
        } else {
          shared = { handle: undefined, users: 1 };
          effects.set(binding, shared);
        }
        held.set(el, shared);
      }
      if (!el.isConnected || !binding.wants(el)) continue;
      if (!binding.blocked?.()) {
        if (shared.handle) {
          if (binding.refreshHeld) shared.handle.refresh?.();
        } else {
          shared.handle = binding.attach(el);
        }
      }
    }
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    for (const [el, shared] of held) release(binding, el, shared);
    held.clear();
  };

  return { sync, dispose, mediaQueries: binding.mediaQueries ?? [] };
}
