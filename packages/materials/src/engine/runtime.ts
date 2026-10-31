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
import { type EngineBinding, mountEngine, trailingRaf } from './mount';
import { attach as attachVeil, supportsBackdropBlur } from './veil';

const SURFACE = '.lab-material';
const VEIL = '[data-veil]';

/** Glass/Acrylic CSS recipes are inside @scope; an unsupported rule falls
 * back to opaque Solid. Do not start invisible SVG filters in that case.
 * Veil has an independent CSS recipe and must keep its own capability gate. */
function supportsScopedMaterialRecipes(): boolean {
  return typeof (globalThis as { CSSScopeRule?: unknown }).CSSScopeRule === 'function';
}

/** An engine holds a `.lab-material` only when its NEAREST material scope carries
 *  the engine's mode — mirroring the material.css selector
 *  `[data-material="<mode>"] .lab-material` (the closest scope wins in CSS
 *  custom-property terms too). */
function inModeScope(el: Element, mode: string): boolean {
  const scope = el.closest('[data-material]');
  return scope !== null && scope.getAttribute('data-material') === mode;
}

/** The three engine bindings — the ONLY place the runtime names concrete engines.
 *  Each пара (mode, engine) — одна строка; порядок несуществен (движки держат
 *  непересекающиеся множества: glass/acrylic по режиму, veil по атрибуту). */
const BINDINGS: readonly EngineBinding[] = [
  // Glass (refraction). refreshHeld:false — сохраняет прежнее поведение: LG
  // ре-рендерит вне этой петли (свой ResizeObserver), рантайм его не дёргает.
  {
    gate: () => supportsScopedMaterialRecipes() && supportsRefraction(),
    selector: SURFACE,
    wants: (el) => inModeScope(el, 'glass'),
    refreshHeld: false,
    attach: attachGlass,
  },
  // Acrylic v2 (luminosity chain). Тот же Chromium-гейт; инлайн сильнее листовых
  // деградаций → blocked() опустошает set под запрещающими медиа, их change
  // ре-синкает mount. refreshHeld:true — перечитать tier на удержанной.
  {
    gate: () => supportsScopedMaterialRecipes() && supportsAcrylicChain(),
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
 * Returns the disposer. Safe to call in any environment: without a DOM or
 * without any supported engine it is an inert no-op.
 */
export function mountMaterialRuntime(root?: Document | Element): () => void {
  if (typeof document === 'undefined') return () => {};
  const scope = root ?? document;

  const engines = BINDINGS.filter((b) => b.gate()).map((b) => mountEngine(b, scope));
  if (engines.length === 0) return () => {};

  const sync = (): void => {
    for (const engine of engines) engine.sync();
  };
  sync();

  // Mutation storms (hydration, list re-render) collapse to ONE sync on the next
  // frame — the final attached set is identical to an un-debounced run.
  const raf = trailingRaf(sync);
  const mo = new MutationObserver(raf.schedule);
  mo.observe(scope instanceof Document ? scope.documentElement : scope, {
    attributes: true,
    attributeFilter: ['data-material', 'class', 'data-veil'],
    childList: true,
    subtree: true,
  });

  // Запрещающие медиа-режимы (сейчас — acrylic): смена → пере-синк (инлайн
  // движка обязан сняться сам, листовые деградации его не перебивают). Собираем
  // объединение медиа-запросов всех смонтированных движков.
  const mediaListeners: MediaQueryList[] = [];
  if (typeof matchMedia !== 'undefined') {
    const queries = new Set(engines.flatMap((e) => [...e.mediaQueries]));
    for (const query of queries) {
      const mq = matchMedia(query);
      mq.addEventListener('change', raf.schedule);
      mediaListeners.push(mq);
    }
  }

  return () => {
    mo.disconnect();
    raf.cancel();
    for (const mq of mediaListeners) mq.removeEventListener('change', raf.schedule);
    for (const engine of engines) engine.dispose();
  };
}
