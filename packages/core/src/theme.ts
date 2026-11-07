/**
 * Theming contract — how Light/Dark and the material mode are selected.
 *
 * Components NEVER read a theme. They read semantic `--lab-*` roles; a theme is
 * just a different binding of those roles on an ancestor. Switching theme is a
 * single attribute flip on the host/root, with zero component edits — the
 * owner's hard requirement and ADR-0001's reversible default.
 *
 * The selector convention below is the agreed contract between this scaffold and
 * the @labpics/colors engine. The colors package MUST bind its role variables
 * under exactly these selectors; `@labpics/ui-materials` (material.css) binds
 * the material axis under the same `[data-theme]` / `[data-material]`
 * attributes, so the two layers compose without coordination beyond this
 * constant.
 */

/** Тема области; отсутствие на корне следует ОС, внутри — ближайшему предку. */
export const THEME_ATTR = 'data-theme';

/** Attribute that selects the material mode. Default (absent) resolves to solid. */
export const MATERIAL_ATTR = 'data-material';

/** Независимый режим контраста. Без атрибута наследуется ближайшая область. */
export const CONTRAST_ATTR = 'data-contrast';
export const CONTRASTS = ['auto', 'normal', 'more'] as const;
export type Contrast = (typeof CONTRASTS)[number];

/** auto начинает новую область от настройки ОС. */
export const THEMES = ['auto', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/**
 * The material modes a root may declare — the flag model (канон ADR-0008:
 * ровно ТРИ материала — Solid/Glass/Acrylic; Solid ≡ Background). The axis
 * itself is owned by `@labpics/ui-materials` (ADR-0003/0004); this constant
 * only fixes the attribute convention. The former `ambient`/`glassy` stub
 * modes were torn down with the temporary core material (#41); отдельный
 * `blur` снесён как перцептивный дубль acrylic (ADR-0008) — `solid` is the
 * default and the universal fallback.
 */
export const MATERIALS = ['solid', 'glass', 'acrylic'] as const;
export type Material = (typeof MATERIALS)[number];

/**
 * Theme resolution order (documented, not re-implemented here — it lives in CSS
 * so it works without JS):
 *   1. nearest ancestor with `[data-theme="…"]` wins;
 *   2. otherwise `@media (prefers-color-scheme)` is the fallback;
 *   3. otherwise the light default — как в contract.css: голый `:root` несёт
 *      light-палитру, dark включается явно или через OS-предпочтение.
 * A component is oblivious to all three — it only ever reads the resolved role.
 */
export const THEME_FALLBACK: Theme = 'light';

/** Set the theme on a root element (host or document root). JS enhancement only. */
export function setTheme(root: Element, theme: Theme): void {
  root.setAttribute(THEME_ATTR, theme);
}

/** Set the material mode on a root element. JS enhancement only. */
export function setMaterial(root: Element, material: Material): void {
  root.setAttribute(MATERIAL_ATTR, material);
}

/** auto следует ОС; normal явно сохраняет эталон даже при системном more. */
export function setContrast(root: Element, contrast: Contrast): void {
  root.setAttribute(CONTRAST_ATTR, contrast);
}
