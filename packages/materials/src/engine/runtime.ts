import { attach as attachContour } from './contour-surface';
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
import { attach as attachPaint } from './paint';
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

function scopedEffectsEnabled(el: Element): boolean {
  for (let scope: Element | null = el; scope; scope = composedParent(scope)) {
    if (scope.hasAttribute('data-contrast')) return scope.getAttribute('data-contrast') !== 'more';
  }
  return true;
}

/** Nearest material and contrast boundaries match the inherited CSS mode. */
function inModeScope(el: Element, mode: string): boolean {
  if (!scopedEffectsEnabled(el)) return false;
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

/** Separate bindings share the lifecycle: Glass geometry, author paints, veil.
 * Paints and lens can hold one surface without writing each other's controls. */
const BINDINGS: readonly EngineBinding[] = [
  {
    gate: () => true,
    selector: SURFACE,
    wants: () => true,
    refreshHeld: true,
    attach: attachContour,
  },
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
  // Shared author paint transfer, applied after frost and optional refraction.
  {
    gate: supportsBackdropBlur,
    selector: SURFACE,
    wants: (el) => inModeScope(el, 'acrylic') || inModeScope(el, 'glass'),
    blocked: materialMediaBlocked,
    mediaQueries: MATERIAL_ENGINE_MEDIA,
    refreshHeld: true,
    attach: attachPaint,
  },
  // Veil (progressive blur) — plain backdrop-filter, любой [data-veil].
  // refreshHeld:true — перечитать декларативный конфиг (top↔left↔axis).
  {
    gate: supportsBackdropBlur,
    selector: VEIL,
    wants: scopedEffectsEnabled,
    blocked: materialMediaBlocked,
    mediaQueries: MATERIAL_ENGINE_MEDIA,
    refreshHeld: true,
    attach: attachVeil,
  },
];

/**
 * Mount the material runtime over `root` (default: the whole document).
 * Returns the disposer. Without a DOM it is an inert no-op. Unsupported
 * engines keep the same scoped CSS material without installing a filter.
 */
export interface MaterialRuntimeOptions {
  /** Component motion scalars used only for translation or explicit fluid veil
   * extents. Corner radii, paints and filter recipes must not depend on them.
   * Actual surface size changes remain observed by each renderer.
   */
  readonly motionProperties?: readonly string[];
}

export function mountMaterialRuntime(
  root?: MaterialRoot,
  options: MaterialRuntimeOptions = {},
): () => void {
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
  const motionProperties = new Set(options.motionProperties);
  const externalStyle = (css: string): string => {
    styleProbe.cssText = css;
    // Compositor motion changes sampling coordinates, not local filter
    // geometry or author paints. ResizeObserver still catches actual sizing.
    for (const name of [
      'transform',
      'translate',
      'rotate',
      'scale',
      'left',
      'top',
      'right',
      'bottom',
    ]) {
      styleProbe.removeProperty(name);
    }
    styleProbe.removeProperty('backdrop-filter');
    styleProbe.removeProperty('-webkit-backdrop-filter');
    styleProbe.removeProperty('--_material-lens-filter');
    styleProbe.removeProperty('--_material-paint-filter');
    styleProbe.removeProperty('--_surface-paint');
    styleProbe.removeProperty('--_noise');
    styleProbe.removeProperty('--lab-contour-clip');
    styleProbe.removeProperty('--lab-contour-inset');
    styleProbe.removeProperty('--_material-contour-rim');
    for (const name of motionProperties) styleProbe.removeProperty(name);
    return styleProbe.cssText;
  };
  const externalClass = (value: string): string =>
    value
      .split(/\s+/)
      .filter((name) => name && name !== 'lab-material--lensed')
      .sort()
      .join(' ');
  const inheritedAncestors = new Set<Node>();
  const slotTargets = new Set<Node>();
  const onSlotChange = (): void => {
    observe();
    collect(scope);
    if (dirty.size) raf.schedule();
  };
  // A disconnected element cannot report its future parent. Observe insertion
  // records only while disconnected; reconnect never scans the document.
  const reconnect = new MutationObserver(() => {
    if (!anchor?.isConnected) return;
    reconnect.disconnect();
    observe();
    collect(scope);
    if (dirty.size) raf.schedule();
  });
  const mo = new MutationObserver((records) => {
    let relocated = false;
    for (const record of records) {
      if (record.type === 'childList') {
        if (inheritedAncestors.has(record.target)) {
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
        if (
          isHtmlElement(record.target) &&
          record.target.matches(VEIL) &&
          [...record.addedNodes, ...record.removedNodes].some(
            (node) => isHtmlElement(node) && node.hasAttribute('data-veil-paint'),
          )
        )
          dirty.add(record.target);
      } else if (isHtmlElement(record.target)) {
        const el = record.target;
        if (record.attributeName === 'data-veil-paint' && el.parentElement?.matches(VEIL))
          dirty.add(el.parentElement);
        if (record.attributeName === 'slot') relocated = true;
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
    'data-veil-profile',
    'data-veil-paint',
    'slot',
  ];
  // Explicit lifecycle mount covers closed roots too. Observe inherited mode
  // changes on ancestors without observing their unrelated descendants.
  const observe = (): void => {
    mo.disconnect();
    inheritedAncestors.clear();
    for (const target of slotTargets) target.removeEventListener('slotchange', onSlotChange);
    slotTargets.clear();
    reconnect.disconnect();
    if (anchor && !anchor.isConnected && doc)
      reconnect.observe(doc, { childList: true, subtree: true });
    slotTargets.add(scope);
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
      if (ancestor.localName === 'slot') slotTargets.add(ancestor);
    }
    // The composed walk skips the actual ShadowRoot parent. Its childList is
    // needed to observe moving an Element scope into another shadow container.
    for (
      let parent = anchor?.parentNode;
      parent;
      parent = isShadowRoot(parent) ? parent.host : parent.parentNode
    ) {
      inheritedAncestors.add(parent);
      // The slot may not exist yet. Its first assignment emits slotchange in
      // the parent's shadow tree, which is outside an Element scope.
      if (isHtmlElement(parent) && parent.shadowRoot) slotTargets.add(parent.shadowRoot);
    }
    for (const target of slotTargets) target.addEventListener('slotchange', onSlotChange);
    for (const ancestor of inheritedAncestors) {
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
    reconnect.disconnect();
    for (const target of slotTargets) target.removeEventListener('slotchange', onSlotChange);
    slotTargets.clear();
    raf.cancel();
    for (const mq of mediaListeners) mq.removeEventListener('change', refreshAll);
    for (const engine of engines) engine.dispose();
    for (const el of surfaces) releasePaint(el);
    surfaces.clear();
    dirty.clear();
  };
}
