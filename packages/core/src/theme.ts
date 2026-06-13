/**
 * Theming contract — how Light/Dark and the material mode are selected.
 *
 * Components NEVER read a theme. They read semantic `--lab-*` roles; a theme is
 * just a different binding of those roles on an ancestor. Switching theme is a
 * single attribute flip on the host/root, with zero component edits — the
 * owner's hard requirement (EPIC.md) and ADR-0001's reversible default.
 *
 * The selector convention below is the agreed contract between this scaffold and
 * the @labpics/colors engine. The colors package MUST bind its role variables
 * under exactly these selectors; `materials.css` already binds the material
 * roles under the same `[data-theme]` / `[data-material]` attributes, so the two
 * layers compose without coordination beyond this constant.
 */

/** Attribute that selects the colour theme. Default (absent) resolves to dark. */
export const THEME_ATTR = 'data-theme';

/** Attribute that selects the material mode. Default (absent) resolves to ambient. */
export const MATERIAL_ATTR = 'data-material';

/** The colour themes a root may declare. */
export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/**
 * The material modes a root may declare. `glassy` is a documented web alias of
 * `ambient` (owner verdict: true glass is native-only) — kept here so the type
 * is honest about what `data-material` accepts, not so components branch on it.
 */
export const MATERIALS = ['ambient', 'solid', 'glassy'] as const;
export type Material = (typeof MATERIALS)[number];

/**
 * Theme resolution order (documented, not re-implemented here — it lives in CSS
 * so it works without JS):
 *   1. nearest ancestor with `[data-theme="…"]` wins;
 *   2. otherwise `@media (prefers-color-scheme)` is the fallback;
 *   3. otherwise the dark default.
 * A component is oblivious to all three — it only ever reads the resolved role.
 */
export const THEME_FALLBACK: Theme = 'dark';

/** Set the theme on a root element (host or document root). JS enhancement only. */
export function setTheme(root: Element, theme: Theme): void {
  root.setAttribute(THEME_ATTR, theme);
}

/** Set the material mode on a root element. JS enhancement only. */
export function setMaterial(root: Element, material: Material): void {
  root.setAttribute(MATERIAL_ATTR, material);
}
