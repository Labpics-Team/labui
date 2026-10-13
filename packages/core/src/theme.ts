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

/** Attribute that selects the colour theme. Default (absent) resolves to light. */
export const THEME_ATTR = 'data-theme';

/** Attribute that selects the material mode. Default (absent) resolves to solid. */
export const MATERIAL_ATTR = 'data-material';

/** The colour themes a root may declare. */
export const THEMES = ['light', 'dark'] as const;
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

/**
 * Перенести theme/material скоуп источника на вынесенный DOM-узел.
 * Имена осей и порядок разрешения принадлежат этому модулю; renderer знает
 * только источник, приёмник и окончание их общего срока жизни.
 * При отсутствии явной темы CSS продолжает следовать OS fallback.
 */
export function bindPortalScope(source: Element, target: Element): () => void {
  if (source.ownerDocument !== target.ownerDocument) {
    throw new Error('Источник и портал должны принадлежать одному документу');
  }
  const Observer = source.ownerDocument.defaultView?.MutationObserver;
  if (!Observer) throw new Error('Для переноса скоупа нужен браузерный документ');

  const axes = [
    [THEME_ATTR, THEMES],
    [MATERIAL_ATTR, MATERIALS],
  ] as const;
  const previous = axes.map(([attribute]) => target.getAttribute(attribute));
  let disposed = false;
  let ancestry: Node[] = [];
  let dependencies: Node[] = [];

  const write = (attribute: string, value: string | null): void => {
    if (target.getAttribute(attribute) === value) return;
    if (value === null) target.removeAttribute(attribute);
    else target.setAttribute(attribute, value);
  };

  const observer = new Observer(refresh);
  function refresh(): void {
    if (disposed) return;
    const next: Node[] = [];
    let node: Node | null = source;
    while (node) {
      next.push(node);
      // CSS-наследование следует за assignedSlot и пересекает shadow host.
      const assigned: HTMLSlotElement | null =
        node.nodeType === 1 ? (node as Element).assignedSlot : null;
      node =
        assigned ??
        node.parentNode ??
        (node.nodeType === 11 ? ((node as ShadowRoot).host ?? null) : null);
    }
    if (next.includes(target)) throw new Error('Портал должен находиться вне скоупа источника');

    // Пока light-DOM узел не назначен в slot, root его parent host не входит
    // в composed ancestry. Он всё равно определяет будущее назначение; slotchange
    // не пересекает shadow boundary, поэтому слушаем этот root непосредственно.
    const roots = next.flatMap((ancestor) => {
      const parent = ancestor.parentNode;
      const root = parent?.nodeType === 1 ? (parent as Element).shadowRoot : null;
      return root ? [root] : [];
    });
    const nextDependencies = [...new Set([...next, ...roots])];
    ancestry = next;
    if (
      nextDependencies.length !== dependencies.length ||
      nextDependencies.some((item, index) => item !== dependencies[index])
    ) {
      observer.disconnect();
      for (const dependency of dependencies) dependency.removeEventListener('slotchange', refresh);
      dependencies = nextDependencies;
      for (const dependency of dependencies) {
        observer.observe(dependency, {
          attributes: true,
          attributeFilter: [THEME_ATTR, MATERIAL_ATTR, 'slot', 'name'],
          childList: true,
        });
        if (dependency.nodeType === 11) dependency.addEventListener('slotchange', refresh);
      }
    }

    for (const [attribute, values] of axes) {
      let value: string | null = null;
      for (const ancestor of ancestry) {
        if (ancestor.nodeType !== 1) continue;
        const candidate = (ancestor as Element).getAttribute(attribute);
        if (candidate !== null && (values as readonly string[]).includes(candidate)) {
          value = candidate;
          break;
        }
      }
      write(attribute, value);
    }
  }

  refresh();
  return () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    for (const dependency of dependencies) dependency.removeEventListener('slotchange', refresh);
    dependencies = [];
    ancestry = [];
    axes.forEach(([attribute], index) => write(attribute, previous[index] ?? null));
  };
}
