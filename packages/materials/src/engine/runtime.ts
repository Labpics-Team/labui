/*
 * @labpics/ui-materials/engine — the declarative material runtime (ADR-0003 §3).
 *
 * The ONLY public JS entry of the engine layer. The engines (`liquid-glass.ts`,
 * `acrylic.ts`, `veil.ts`) stay package-internal; consumers never call attach()
 * per element. Instead: one app-level mount, and
 *   · every `.lab-material` surface under a `data-material="glass"` scope is
 *     upgraded to the refraction engine,
 *   · every `.lab-material` under `data-material="acrylic"` is upgraded to the
 *     luminosity chain (ADR-0009), and
 *   · every `[data-veil]` surface grows its progressive-blur strip stack
 * automatically — the same zero markup-change promise the material axis makes.
 *
 * ── Один оркестратор на три движка (Clean Arch / DRY / OCP) ──────────────────
 * Каждый движок — это `EngineBinding` (gate + selector + wants + attach);
 * `mountEngine` (./mount) исполняет ЕДИНУЮ механику скана/attach/detach. Раньше
 * — три почти дословных блока здесь. Рантайм не знает про внутренности движков,
 * только про порт; новый движок = новый binding в массиве ниже, механика не
 * трогается.
 *
 *   · Non-refracting browsers (everything but Chromium): glass/acrylic gates are
 *     false — их scan вообще не создаётся, CSS-стек material.css остаётся истиной.
 *     Veil гейтится отдельно на plain backdrop-filter (его единственное железное
 *     требование); без него mount ничего не пишет.
 *   · `data-material` / class / `data-veil` re-binds, added/removed surfaces: один
 *     MutationObserver ре-синкает все движки; rAF-сворачивание превращает шторм
 *     мутаций в один sync. Смена запрещающих медиа acrylic — тот же ре-синк.
 *   · Disposer снимает владение своего scope. Пересекающиеся mount сохраняют
 *     общий эффект до последнего release, который восстанавливает исходные стили.
 */

import { attach as attachAcrylic, supportsAcrylicChain } from './acrylic';
import { attach as attachGlass, supportsRefraction } from './liquid-glass';
import {
  type EngineBinding,
  collectSurfaces,
  mountEngine,
  supportsBackdropFilterUrl,
  trailingRaf,
} from './mount';
import { MATERIAL_ENGINE_MEDIA, materialMediaBlocked, prefersMoreContrast } from './preferences';
import { attach as attachSheet } from './sheet';
import { attach as attachVeil, supportsBackdropBlur } from './veil';

const SURFACE = '.lab-material';
const VEIL = '[data-veil]';

/** CSS — владелец эффективного режима, включая slot-наследование и медиа.
 * Без material CSS свойство отсутствует: поверхность остаётся без live-движка. */
function inModeScope(el: Element, mode: string): boolean {
  return (
    el.ownerDocument.defaultView
      ?.getComputedStyle(el)
      .getPropertyValue('--_material-mode')
      .trim() === mode
  );
}

/** Единственное место выбора конкретных движков. Glass/acrylic исключают друг
 *  друга по режиму; veil живёт независимо и может держать ту же поверхность. */
const BINDINGS: readonly EngineBinding[] = [
  // Glass (refraction). refreshHeld:false — сохраняет прежнее поведение: LG
  // ре-рендерит вне этой петли (свой ResizeObserver), рантайм его не дёргает.
  {
    gate: supportsRefraction,
    selector: SURFACE,
    wants: (el) => inModeScope(el, 'glass') && !prefersMoreContrast(el),
    blocked: materialMediaBlocked,
    mediaQueries: MATERIAL_ENGINE_MEDIA,
    refreshHeld: false,
    attach: attachGlass,
  },
  // Acrylic v2 (luminosity chain). Тот же Chromium-гейт; инлайн сильнее листовых
  // деградаций → blocked() опустошает set под запрещающими медиа, их change
  // ре-синкает mount. refreshHeld:true — перечитать tier на удержанной.
  {
    gate: supportsAcrylicChain,
    selector: SURFACE,
    wants: (el) =>
      inModeScope(el, 'acrylic') &&
      !prefersMoreContrast(el) &&
      !el.classList.contains('lab-material--sheet'),
    blocked: materialMediaBlocked,
    mediaQueries: MATERIAL_ENGINE_MEDIA,
    refreshHeld: true,
    attach: attachAcrylic,
  },
  {
    gate: supportsBackdropFilterUrl,
    selector: '.lab-material.lab-material--sheet',
    wants: (el) => inModeScope(el, 'acrylic') && !prefersMoreContrast(el),
    blocked: materialMediaBlocked,
    mediaQueries: MATERIAL_ENGINE_MEDIA,
    refreshHeld: true,
    attach: attachSheet,
  },
  // Veil (progressive blur) — plain backdrop-filter, любой [data-veil].
  // refreshHeld:true — перечитать декларативный конфиг (top↔left↔axis).
  {
    gate: supportsBackdropBlur,
    selector: VEIL,
    wants: () => true,
    mediaQueries: MATERIAL_ENGINE_MEDIA,
    refreshHeld: true,
    attach: attachVeil,
  },
];

/**
 * Mount the material runtime over `root` (default: the whole document).
 * Returns the disposer. Safe to call in any environment: without a DOM or
 * without any supported engine it is an inert no-op.
 */
export function mountMaterialRuntime(root?: Document | Element): () => void {
  if (typeof document === 'undefined') return () => {};
  const scope = root ?? document;

  const bindings = BINDINGS.filter((binding) => binding.gate());
  const engines = bindings.map((binding) => mountEngine(binding, scope));
  if (engines.length === 0) return () => {};
  const contextSelector = bindings.map((binding) => binding.selector).join(',');

  let disposed = false;
  const sync = (): void => {
    if (disposed) return;
    observeContext();
    for (const engine of engines) engine.sync();
  };

  // Mutation storms (hydration, list re-render) collapse to ONE sync on the next
  // frame — the final attached set is identical to an un-debounced run.
  const raf = trailingRaf(sync);
  const schedule = (): void => {
    if (!disposed) raf.schedule();
  };
  const mo = new MutationObserver(schedule);
  let observed = new Map<Node, boolean>();
  let slotRoots = new Set<ShadowRoot>();

  function observeContext(): void {
    const context = collectSurfaces(scope, contextSelector);
    const subtrees = [...context.scopes].map((current) =>
      current instanceof Document ? current.documentElement : current,
    );
    const ancestors = new Set<Node>();
    const roots = new Set<ShadowRoot>();
    const visited = new Set<Node>();
    // Назначенный контейнер остаётся наблюдаемым и без выбранных поверхностей:
    // добавление veil в его поддерево само по себе не вызывает slotchange.
    for (const start of [...subtrees, ...context.surfaces]) {
      let node: Node | null = start;
      while (node && !visited.has(node)) {
        visited.add(node);
        if (!subtrees.some((root) => root.contains(node))) ancestors.add(node);
        if (node instanceof Element && node.shadowRoot) roots.add(node.shadowRoot);
        // assignedSlot закрытого чужого root недоступен. Его скрытые wrappers
        // требуют участия владельца; этот runtime не наблюдает их по догадке.
        if (node instanceof Element && node.assignedSlot) {
          node = node.assignedSlot;
        } else if (node.parentNode) {
          node = node.parentNode;
        } else if (node instanceof ShadowRoot) {
          roots.add(node);
          node = node.host;
        } else {
          node = null;
        }
      }
    }
    const next = new Map<Node, boolean>();
    for (const node of subtrees) next.set(node, true);
    for (const node of ancestors) next.set(node, false);
    if (
      next.size !== observed.size ||
      [...next].some(([node, subtree]) => observed.get(node) !== subtree)
    ) {
      mo.disconnect();
      const options = {
        attributes: true,
        attributeFilter: [
          'data-material',
          'data-theme',
          'class',
          'style',
          'data-veil',
          'data-contrast',
          'slot',
          'name',
        ],
        childList: true,
      };
      for (const [node, subtree] of next) mo.observe(node, { ...options, subtree });
      observed = next;
    }
    for (const previous of slotRoots) {
      if (!roots.has(previous)) previous.removeEventListener('slotchange', schedule);
    }
    for (const current of roots) {
      if (!slotRoots.has(current)) current.addEventListener('slotchange', schedule);
    }
    slotRoots = roots;
  }
  // Смена системного контекста перечитывает материал даже без сигнала от CSS-бокса.
  // Один набор подписок обслуживает все смонтированные движки и снимается при dispose.
  const mediaListeners: MediaQueryList[] = [];
  if (typeof matchMedia !== 'undefined') {
    const queries = new Set(engines.flatMap((e) => [...e.mediaQueries]));
    for (const query of queries) {
      const mq = matchMedia(query);
      mq.addEventListener('change', schedule);
      mediaListeners.push(mq);
    }
  }

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    mo.disconnect();
    for (const root of slotRoots) root.removeEventListener('slotchange', schedule);
    slotRoots.clear();
    raf.cancel();
    for (const mq of mediaListeners) mq.removeEventListener('change', schedule);
    for (const engine of engines) engine.dispose();
  };
  try {
    sync();
    return dispose;
  } catch (error) {
    dispose();
    throw error;
  }
}
