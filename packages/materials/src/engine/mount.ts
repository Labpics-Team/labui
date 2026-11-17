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
 * backdrop — только Chromium. Это граница рефракции liquid-glass и прямого
 * paint transfer; Firefox/Safari используют отдельные paint-адаптеры.
 * Ответ не меняется в
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
 * Единый скрытый `<svg><defs>` хост для url()-фильтров движков (авторские paints, линза liquid-glass). Один на `className` на документ;
 * невидимый, вне hit-теста и a11y-дерева. Раньше — две дословных копии
 * (`ensureDefs` в liquid-glass, `ensureAcrylicDefs` в acrylic).
 */
const defsHosts = new WeakMap<Document | ShadowRoot, Map<string, SVGDefsElement>>();
export function ensureHiddenDefs(className: string, surface?: HTMLElement): SVGDefsElement {
  const doc = surface?.ownerDocument ?? document;
  const tree = surface?.getRootNode();
  const root = tree?.nodeType === 11 ? (tree as ShadowRoot) : doc;
  let hosts = defsHosts.get(root);
  if (!hosts) {
    hosts = new Map();
    defsHosts.set(root, hosts);
  }
  const cached = hosts.get(className);
  if (cached?.isConnected) return cached;
  const svg = doc.createElementNS(SVGNS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', className);
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  const defs = doc.createElementNS(SVGNS, 'defs');
  svg.appendChild(defs);
  (root === doc ? doc.body : root).appendChild(svg);
  hosts.set(className, defs);
  return defs;
}

/** The last surface releases the hidden host as well as its own filter. */
export function removeFilter(filter: SVGFilterElement): void {
  const defs = filter.parentElement;
  filter.remove();
  if (defs && !defs.firstChild) defs.parentElement?.remove();
}

export type MaterialRoot = Document | Element | ShadowRoot;

export function isHtmlElement(node: Node): node is HTMLElement {
  return node.nodeType === 1 && (node as Element).namespaceURI === 'http://www.w3.org/1999/xhtml';
}

export function isShadowRoot(node: Node): node is ShadowRoot {
  return node.nodeType === 11 && 'host' in node;
}

export const MATERIAL_ENGINE_MEDIA = [
  '(prefers-reduced-transparency: reduce)',
  '(forced-colors: active)',
  '(prefers-contrast: more)',
] as const;

export function materialMediaBlocked(): boolean {
  return (
    typeof matchMedia !== 'undefined' &&
    MATERIAL_ENGINE_MEDIA.some((query) => matchMedia(query).matches)
  );
}

/** CSS inheritance crosses a shadow host; Element.closest() does not. */
export function composedParent(el: Element): Element | null {
  if (el.assignedSlot) return el.assignedSlot;
  if (el.parentElement) return el.parentElement;
  const root = el.getRootNode();
  return isShadowRoot(root) ? root.host : null;
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

/** Живёт, пока движок держит поверхность. `refresh` перечитывает локальный конфиг. */
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
  /** Держать ли эту поверхность (ближайший скоуп мода / всегда для veil). */
  wants(el: HTMLElement): boolean;
  /** Медиа-режим временно запрещает движок (acrylic под reduced-transparency
   *  и т.п.: инлайн сильнее листовых деградаций, поэтому движок гаснет сам). */
  blocked?(): boolean;
  /** Медиа-запросы, чья смена требует пере-синка (регистрируются рантаймом). */
  readonly mediaQueries?: readonly string[];
  /** Перечитать конфиг удержанной поверхности при её локальном обновлении. */
  readonly refreshHeld: boolean;
  /** Прицепить движок к поверхности; вернуть её хэндл. */
  attach(el: HTMLElement): EngineHandle;
}

/** Смонтированный движок: одна sync-функция + утилизатор. */
export interface MountedEngine {
  sync(candidates?: Iterable<HTMLElement>): void;
  dispose(): void;
  readonly mediaQueries: readonly string[];
}

// Overlapping app/element mounts share one engine instance. Each mount releases
// only its own reference; an inner component cannot destroy the app's surface.
interface SharedInstance {
  handle: EngineHandle;
  refs: number;
  root: Node;
  retired: boolean;
}
const instances = new WeakMap<EngineBinding, WeakMap<HTMLElement, SharedInstance>>();

/**
 * Единая механика монтирования одного движка над `scope`. Заменяет три
 * дословных блока runtime.ts. `sync` идемпотентна: держит ровно те поверхности,
 * что проходят `wants` (и не под `blocked`), отцепляя ушедшие.
 */
export function mountEngine(binding: EngineBinding, scope: MaterialRoot): MountedEngine {
  const held = new Map<HTMLElement, SharedInstance>();
  let shared = instances.get(binding);
  if (!shared) {
    shared = new WeakMap();
    instances.set(binding, shared);
  }
  const retire = (el: HTMLElement, instance: SharedInstance): void => {
    if (!instance.retired) {
      instance.retired = true;
      instance.handle.destroy();
    }
    if (shared.get(el) === instance) shared.delete(el);
  };
  const release = (el: HTMLElement): void => {
    const instance = held.get(el);
    if (instance && --instance.refs === 0) retire(el, instance);
    held.delete(el);
  };

  const sync = (candidates?: Iterable<HTMLElement>): void => {
    // Full discovery occurs only at mount. Later calls supply affected surfaces;
    // media changes revisit the registered set without querying the document.
    const changes =
      candidates ??
      new Set([
        ...held.keys(),
        ...(isHtmlElement(scope) ? [scope] : []),
        ...Array.from(scope.querySelectorAll<HTMLElement>(binding.selector)),
      ]);
    const blocked = binding.blocked?.() ?? false;
    for (const el of changes) {
      let instance = shared.get(el);
      const valid = !blocked && el.isConnected && el.matches(binding.selector) && binding.wants(el);
      // A mode/tree change invalidates the actual effect immediately, even if
      // another scope has not processed its mutation batch yet. Retired leases
      // later release their own instance, never a replacement's inline style.
      if (instance && (!valid || instance.root !== el.getRootNode())) {
        retire(el, instance);
        instance = undefined;
      }
      const previous = held.get(el);
      if (previous && (previous.retired || !scope.contains(el) || !valid)) release(el);
      if (!valid || !scope.contains(el)) continue;
      if (held.has(el)) {
        if (binding.refreshHeld) instance?.handle.refresh?.();
      } else {
        if (!instance) {
          instance = {
            handle: binding.attach(el),
            refs: 0,
            root: el.getRootNode(),
            retired: false,
          };
          shared.set(el, instance);
        }
        instance.refs++;
        held.set(el, instance);
      }
    }
  };

  const dispose = (): void => {
    for (const el of held.keys()) release(el);
  };

  return { sync, dispose, mediaQueries: binding.mediaQueries ?? [] };
}
