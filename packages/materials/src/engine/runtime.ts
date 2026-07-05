/*
 * @labpics/ui-materials/engine — the declarative glass runtime (ADR-0003 §3).
 *
 * The ONLY public JS entry of the glass upgrade. The engine (`liquid-glass.ts`)
 * stays package-internal; consumers never call attach() per element. Instead:
 * one app-level mount, and every `.lab-material` surface under a
 * `data-material="glass"` scope is upgraded automatically — the same zero
 * markup-change promise the material axis already makes.
 *
 *   · Non-refracting browsers (everything but Chromium today): the mount is a
 *     NO-OP — the CSS stack in material.css is the truth, nothing is written.
 *   · `data-material` re-binds (glass↔solid↔blur), added/removed surfaces,
 *     class changes: one MutationObserver re-syncs the attached set; a rAF
 *     collapse turns mutation storms into one sync (same trailing-edge
 *     strategy the engine uses for resize storms).
 *   · Unmount (the returned disposer) detaches every engine instance and
 *     restores the pure-CSS stack — SSR/HMR friendly.
 */

import { type LiquidGlassHandle, attach, supportsRefraction } from './liquid-glass';

const SURFACE = '.lab-material';
const GLASS = 'glass';

/** A surface refracts only when its NEAREST material scope says `glass` —
 *  mirroring the material.css selector `[data-material="glass"] .lab-material`
 *  (the closest scope wins in CSS custom-property terms too). */
function inGlassScope(el: Element): boolean {
  const scope = el.closest('[data-material]');
  return scope !== null && scope.getAttribute('data-material') === GLASS;
}

/**
 * Mount the glass runtime over `root` (default: the whole document). Returns
 * the disposer. Safe to call in any environment: without a DOM or without
 * refraction support it is an inert no-op.
 */
export function mountMaterialRuntime(root?: Document | Element): () => void {
  if (typeof document === 'undefined') return () => {};
  const scope = root ?? document;
  if (!supportsRefraction()) return () => {};

  const handles = new Map<HTMLElement, LiquidGlassHandle>();

  const sync = (): void => {
    const want = new Set<HTMLElement>();
    for (const el of scope.querySelectorAll(SURFACE)) {
      if (el instanceof HTMLElement && inGlassScope(el)) want.add(el);
    }
    if (scope instanceof HTMLElement && scope.matches(SURFACE) && inGlassScope(scope)) {
      want.add(scope);
    }
    // Detach surfaces that left the glass set (mode re-bind, class change,
    // removal); their inline style clears → material.css owns them again.
    for (const [el, handle] of handles) {
      if (!want.has(el) || !el.isConnected) {
        handle.destroy();
        handles.delete(el);
      }
    }
    // Attach newcomers exactly once (attach() is keyed per element; the
    // handles map guards re-entry so a sync never re-attaches).
    for (const el of want) {
      if (!handles.has(el)) handles.set(el, attach(el));
    }
  };

  sync();

  // Mutation storms (hydration, list re-render) collapse to ONE sync on the
  // next frame — the final attached set is identical to an un-debounced run.
  let rafId = 0;
  const debouncedSync = (): void => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      sync();
    });
  };
  const mo = new MutationObserver(debouncedSync);
  mo.observe(scope instanceof Document ? scope.documentElement : scope, {
    attributes: true,
    attributeFilter: ['data-material', 'class'],
    childList: true,
    subtree: true,
  });

  return () => {
    mo.disconnect();
    if (rafId) cancelAnimationFrame(rafId);
    for (const handle of handles.values()) handle.destroy();
    handles.clear();
  };
}
