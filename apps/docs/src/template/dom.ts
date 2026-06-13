/*
 * Tiny typed DOM helpers — the only way the template touches the document.
 *
 * Why this exists: the renderers build real nodes, never HTML strings. All text
 * from a `ComponentDoc` goes through `el(..., text)` / `.textContent`, so the
 * browser escapes it — there is no `innerHTML` sink for config-supplied text
 * (craft-frontend P11: treat all data as untrusted, even our own). It also keeps
 * the renderers terse and declarative without a framework.
 */

type Attrs = Record<string, string | number | boolean | undefined>;

/**
 * Create an element with attributes and children. `string`/`number` children
 * become text nodes (escaped by the platform); `Node` children are appended.
 * Boolean attrs are set as present/absent; `undefined` attrs are skipped.
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: ReadonlyArray<Node | string | number> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (value === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, String(value));
    }
  }
  for (const child of children) {
    node.append(typeof child === 'object' ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Convenience: a `<section>` with a heading and body, the page's section shell. */
export function section(headingId: string, heading: string, body: Node[]): HTMLElement {
  return el('section', { 'aria-labelledby': headingId, class: 'doc-section' }, [
    el('h2', { id: headingId }, [heading]),
    ...body,
  ]);
}
