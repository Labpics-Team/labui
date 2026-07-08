/*
 * @labpics/ui-materials/engine — the declarative material runtime (ADR-0003 §3).
 *
 * The ONLY public JS entry of the engine layer. The engines (`liquid-glass.ts`,
 * `veil.ts`) stay package-internal; consumers never call attach() per element.
 * Instead: one app-level mount, and
 *   · every `.lab-material` surface under a `data-material="glass"` scope is
 *     upgraded to the refraction engine, and
 *   · every `[data-veil]` surface grows its progressive-blur strip stack
 * automatically — the same zero markup-change promise the material axis
 * already makes.
 *
 *   · Non-refracting browsers (everything but Chromium today): the GLASS scan
 *     is a NO-OP — the CSS stack in material.css is the truth, nothing is
 *     written. The VEIL scan is gated separately on plain backdrop-filter
 *     support (its only hard requirement); without it the mount writes
 *     nothing and content stays untouched (the honest degradation).
 *   · `data-material` re-binds (glass↔solid↔blur), `data-veil` re-binds
 *     (top↔left↔axis), added/removed surfaces, class changes: one
 *     MutationObserver re-syncs the attached sets; a rAF collapse turns
 *     mutation storms into one sync (same trailing-edge strategy the engines
 *     use for resize storms).
 *   · Unmount (the returned disposer) detaches every engine instance and
 *     restores the pure-CSS stack — SSR/HMR friendly.
 */

import { type LiquidGlassHandle, attach as attachGlass, supportsRefraction } from './liquid-glass';
import { type VeilHandle, attach as attachVeil, supportsBackdropBlur } from './veil';

const SURFACE = '.lab-material';
const GLASS = 'glass';
const VEIL = '[data-veil]';

/** A surface refracts only when its NEAREST material scope says `glass` —
 *  mirroring the material.css selector `[data-material="glass"] .lab-material`
 *  (the closest scope wins in CSS custom-property terms too). */
function inGlassScope(el: Element): boolean {
  const scope = el.closest('[data-material]');
  return scope !== null && scope.getAttribute('data-material') === GLASS;
}

/**
 * Mount the material runtime over `root` (default: the whole document).
 * Returns the disposer. Safe to call in any environment: without a DOM or
 * without any supported engine it is an inert no-op.
 */
export function mountMaterialRuntime(root?: Document | Element): () => void {
  if (typeof document === 'undefined') return () => {};
  const scope = root ?? document;

  const syncs: (() => void)[] = [];
  const disposers: (() => void)[] = [];

  /* ── Glass (refraction engine) — Chromium-gated. ─────────────────────────── */
  if (supportsRefraction()) {
    const handles = new Map<HTMLElement, LiquidGlassHandle>();

    syncs.push((): void => {
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
        if (!handles.has(el)) handles.set(el, attachGlass(el));
      }
    });

    disposers.push((): void => {
      for (const handle of handles.values()) handle.destroy();
      handles.clear();
    });
  }

  /* ── Veil (progressive blur) — gated on plain backdrop-filter support, the
   * effect's only hard requirement (reduced-transparency honesty lives inside
   * the engine's render, plus the material.css backstop). ─────────────────── */
  if (supportsBackdropBlur()) {
    const veils = new Map<HTMLElement, VeilHandle>();

    syncs.push((): void => {
      const want = new Set<HTMLElement>();
      for (const el of scope.querySelectorAll(VEIL)) {
        if (el instanceof HTMLElement) want.add(el);
      }
      if (scope instanceof HTMLElement && scope.matches(VEIL)) want.add(scope);
      for (const [el, handle] of veils) {
        if (!want.has(el) || !el.isConnected) {
          handle.destroy();
          veils.delete(el);
        }
      }
      for (const el of want) {
        const held = veils.get(el);
        // A held surface may have re-bound its attribute (top→left→axis) —
        // refresh re-reads the declarative config; the engine's config
        // signature short-circuits it to a no-op when nothing changed.
        if (held) held.refresh();
        else veils.set(el, attachVeil(el));
      }
    });

    disposers.push((): void => {
      for (const handle of veils.values()) handle.destroy();
      veils.clear();
    });
  }

  if (syncs.length === 0) return () => {};

  const sync = (): void => {
    for (const s of syncs) s();
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
    attributeFilter: ['data-material', 'class', 'data-veil'],
    childList: true,
    subtree: true,
  });

  return () => {
    mo.disconnect();
    if (rafId) cancelAnimationFrame(rafId);
    for (const dispose of disposers) dispose();
  };
}
