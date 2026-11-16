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
 *     MutationObserver collects only changed subtrees; rAF coalesces affected
 *     surfaces. Media changes revisit registered surfaces without discovery.
 *   · Unmount (returned disposer) отцепляет все инстансы и восстанавливает
 *     чистый CSS-стек — SSR/HMR-friendly.
 */

import {
  ACRYLIC_ENGINE_MEDIA,
  acrylicMediaBlocked,
  attach as attachAcrylic,
  supportsAcrylicChain,
} from './acrylic';
import { attach as attachGlass, supportsRefraction } from './liquid-glass';
import {
  type EngineBinding,
  MATERIAL_ENGINE_MEDIA,
  type MaterialRoot,
  composedParent,
  isHtmlElement,
  isShadowRoot,
  materialMediaBlocked,
  mountEngine,
  trailingRaf,
} from './mount';
import { attach as attachVeil, supportsBackdropBlur } from './veil';

const SURFACE = '.lab-material';
const VEIL = '[data-veil]';
const MODE_ATTR = 'data-lab-material-mode';
const THEME_ATTR = 'data-lab-material-theme';
const paintRefs = new WeakMap<HTMLElement, number>();
const releasePaint = (el: HTMLElement): void => {
  const refs = (paintRefs.get(el) ?? 1) - 1;
  if (refs) paintRefs.set(el, refs);
  else {
    paintRefs.delete(el);
    el.removeAttribute(MODE_ATTR);
    el.removeAttribute(THEME_ATTR);
  }
};

/** An engine holds a `.lab-material` only when its NEAREST material scope carries
 *  the engine's mode — mirroring the material.css selector
 *  `[data-material="<mode>"] .lab-material` (the closest scope wins in CSS
 *  custom-property terms too). */
function inModeScope(el: Element, mode: string): boolean {
  for (let scope: Element | null = el; scope; scope = composedParent(scope)) {
    if (scope.hasAttribute('data-contrast')) {
      if (scope.getAttribute('data-contrast') === 'more') return false;
      break;
    }
  }
  for (let scope: Element | null = el; scope; scope = composedParent(scope)) {
    if (scope.hasAttribute('data-material')) return scope.getAttribute('data-material') === mode;
  }
  return false;
}

function themeOf(el: Element): string {
  for (let scope: Element | null = el; scope; scope = composedParent(scope)) {
    if (scope.hasAttribute('data-theme'))
      return scope.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }
  return el.ownerDocument.defaultView?.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/** The three engine bindings — the ONLY place the runtime names concrete engines.
 *  Each пара (mode, engine) — одна строка; порядок несуществен (движки держат
 *  непересекающиеся множества: glass/acrylic по режиму, veil по атрибуту). */
const BINDINGS: readonly EngineBinding[] = [
  // Glass geometry/knobs follow local tier and theme configuration changes.
  {
    gate: supportsRefraction,
    selector: SURFACE,
    wants: (el) => inModeScope(el, 'glass'),
    blocked: materialMediaBlocked,
    mediaQueries: MATERIAL_ENGINE_MEDIA,
    refreshHeld: true,
    attach: attachGlass,
  },
  // Acrylic v2 (luminosity chain). Тот же Chromium-гейт; инлайн сильнее листовых
  // деградаций → blocked() опустошает set под запрещающими медиа, их change
  // ре-синкает mount. refreshHeld:true — перечитать tier на удержанной.
  {
    gate: supportsAcrylicChain,
    selector: SURFACE,
    wants: (el) => inModeScope(el, 'acrylic'),
    blocked: acrylicMediaBlocked,
    mediaQueries: ACRYLIC_ENGINE_MEDIA,
    refreshHeld: true,
    attach: attachAcrylic,
  },
  // Veil (progressive blur) — plain backdrop-filter, любой [data-veil].
  // refreshHeld:true — перечитать декларативный конфиг (top↔left↔axis).
  {
    gate: supportsBackdropBlur,
    selector: VEIL,
    wants: () => true,
    refreshHeld: true,
    attach: attachVeil,
  },
];

/**
 * Mount the material runtime over `root` (default: the whole document).
 * Returns the disposer. Without a DOM it is an inert no-op. Unsupported
 * engines keep the same scoped CSS material without installing a filter.
 */
export function mountMaterialRuntime(root?: MaterialRoot): () => void {
  if (typeof document === 'undefined') return () => {};
  const scope = root ?? document;
  const doc = scope.nodeType === 9 ? (scope as Document) : scope.ownerDocument;
  const anchor = isShadowRoot(scope)
    ? scope.host
    : scope.nodeType === 1
      ? (scope as Element)
      : null;

  const engines = BINDINGS.filter((b) => b.gate()).map((b) => mountEngine(b, scope));

  const surfaces = new Set<HTMLElement>();
  const dirty = new Set<HTMLElement>();
  const selector = `${SURFACE},${VEIL}`;
  const collect = (node: Node): void => {
    if (isHtmlElement(node) && (node.matches(selector) || surfaces.has(node))) dirty.add(node);
    if ('querySelectorAll' in node) {
      for (const el of (node as ParentNode).querySelectorAll<HTMLElement>(selector)) {
        if (isHtmlElement(el)) dirty.add(el);
      }
    }
  };
  const sync = (): void => {
    const changes = [...dirty];
    dirty.clear();
    const mediaBlocked = materialMediaBlocked();
    for (const el of changes) {
      if (el.isConnected && scope.contains(el) && el.matches(selector)) {
        if (!surfaces.has(el)) paintRefs.set(el, (paintRefs.get(el) ?? 0) + 1);
        surfaces.add(el);
        // Resolve the inherited mode once at registration/update. The stylesheet
        // can now paint the same recipe across a shadow boundary and nested modes.
        if (el.matches(SURFACE)) {
          const mode = mediaBlocked
            ? 'solid'
            : inModeScope(el, 'glass')
              ? 'glass'
              : inModeScope(el, 'acrylic')
                ? 'acrylic'
                : 'solid';
          if (el.getAttribute(MODE_ATTR) !== mode) el.setAttribute(MODE_ATTR, mode);
          const theme = themeOf(el);
          if (el.getAttribute(THEME_ATTR) !== theme) el.setAttribute(THEME_ATTR, theme);
        } else {
          el.removeAttribute(MODE_ATTR);
          el.removeAttribute(THEME_ATTR);
        }
      } else if (surfaces.delete(el)) releasePaint(el);
    }
    for (const engine of engines) engine.sync(changes);
  };
  collect(scope);
  sync();
  const raf = trailingRaf(sync);
  // Engine-owned inline backdrop changes and its state class must not schedule
  // themselves forever. Other style changes (tokens, radii) refresh the subtree.
  const styleProbe = (doc ?? document).createElement('div').style;
  const externalStyle = (css: string): string => {
    styleProbe.cssText = css;
    styleProbe.removeProperty('backdrop-filter');
    styleProbe.removeProperty('-webkit-backdrop-filter');
    return styleProbe.cssText;
  };
  const externalClass = (value: string): string =>
    value
      .split(/\s+/)
      .filter((name) => name && name !== 'lab-material--lensed')
      .sort()
      .join(' ');
  const inheritedAncestors = new Set<Element>();
  const mo = new MutationObserver((records) => {
    let relocated = false;
    for (const record of records) {
      if (record.type === 'childList') {
        if (inheritedAncestors.has(record.target as Element)) {
          if (
            anchor &&
            [...record.addedNodes, ...record.removedNodes].some(
              (node) => node === anchor || node.contains(anchor),
            )
          )
            relocated = true;
          continue;
        }
        for (const node of record.addedNodes) collect(node);
        for (const node of record.removedNodes) collect(node);
      } else if (isHtmlElement(record.target)) {
        const el = record.target;
        if (
          record.attributeName === 'style' &&
          externalStyle(record.oldValue ?? '') === externalStyle(el.style.cssText)
        )
          continue;
        if (
          record.attributeName === 'class' &&
          externalClass(record.oldValue ?? '') === externalClass(el.className)
        )
          continue;
        collect(inheritedAncestors.has(el) ? scope : el);
      }
    }
    if (relocated) {
      observe();
      collect(scope);
    }
    if (dirty.size) raf.schedule();
  });
  const attributes = [
    'data-material',
    'data-theme',
    'data-contrast',
    'class',
    'style',
    'data-veil',
  ];
  // Explicit lifecycle mount covers closed roots too. Observe inherited mode
  // changes on ancestors without observing their unrelated descendants.
  const observe = (): void => {
    mo.disconnect();
    inheritedAncestors.clear();
    mo.observe(scope.nodeType === 9 ? (scope as Document).documentElement : scope, {
      attributes: true,
      attributeOldValue: true,
      attributeFilter: attributes,
      childList: true,
      subtree: true,
    });
    for (
      let ancestor = isShadowRoot(scope) ? scope.host : anchor ? composedParent(anchor) : null;
      ancestor;
      ancestor = composedParent(ancestor)
    ) {
      inheritedAncestors.add(ancestor);
      mo.observe(ancestor, {
        attributes: true,
        attributeOldValue: true,
        attributeFilter: attributes,
        childList: true,
      });
    }
  };
  observe();

  // Запрещающие медиа-режимы (сейчас — acrylic): смена → пере-синк (инлайн
  // движка обязан сняться сам, листовые деградации его не перебивают). Собираем
  // объединение медиа-запросов всех смонтированных движков.
  const mediaListeners: MediaQueryList[] = [];
  const refreshAll = (): void => {
    for (const el of surfaces) dirty.add(el);
    if (dirty.size) raf.schedule();
  };
  if (typeof matchMedia !== 'undefined') {
    const queries = new Set([
      '(prefers-color-scheme: dark)',
      ...MATERIAL_ENGINE_MEDIA,
      ...engines.flatMap((e) => [...e.mediaQueries]),
    ]);
    for (const query of queries) {
      const mq = matchMedia(query);
      mq.addEventListener('change', refreshAll);
      mediaListeners.push(mq);
    }
  }

  return () => {
    mo.disconnect();
    raf.cancel();
    for (const mq of mediaListeners) mq.removeEventListener('change', refreshAll);
    for (const engine of engines) engine.dispose();
    for (const el of surfaces) releasePaint(el);
    surfaces.clear();
    dirty.clear();
  };
}
