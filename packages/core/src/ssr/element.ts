import './environment.js';
import { getElementRenderer } from '@lit-labs/ssr/lib/element-renderer.js';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import type { ElementSsrInputs, RenderedElementParts } from './element-types.js';
import { createRenderContext } from './render-context.js';
export type { ElementSsrInputs, RenderedElementParts } from './element-types.js';

// HTML presence attributes; aria/data values retain their literal true/false.
const booleanAttributes = new Set(
  'allowfullscreen async autofocus autoplay checked controls default defer disabled formnovalidate hidden inert ismap itemscope loop multiple muted nomodule novalidate open playsinline readonly required reversed selected'.split(
    ' ',
  ),
);
const reservedAttributes = new Set(['children', 'slots', 'key', 'ref', 'innerHTML', 'textContent']);

/**
 * Render just the element-owned portion of a framework host. Native frameworks
 * retain their class/style objects, handlers and children; only scalar native
 * attributes cross into the element's server instance before its render.
 */
export function renderElementParts(
  tag: string,
  { specs, props, attributes = {} }: ElementSsrInputs,
): RenderedElementParts | undefined {
  if (!customElements.get(tag)) throw new Error(`Unregistered SSR custom element: ${tag}`);
  const context = createRenderContext();
  const renderer = getElementRenderer(context, tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (reservedAttributes.has(key) || /^on/i.test(key) || key.startsWith('.')) continue;
    if (!['string', 'number', 'boolean'].includes(typeof value)) continue;
    const name = (key.startsWith('^') ? key.slice(1) : key).toLowerCase();
    if (booleanAttributes.has(name) && (typeof value === 'boolean' || typeof value === 'number')) {
      if (value) renderer.setAttribute(name, '');
    } else renderer.setAttribute(name, String(value));
  }
  for (const spec of specs) {
    const value = props[spec.name];
    if (value === undefined) continue;
    if (spec.kind === 'string') {
      if (value !== null) renderer.setAttribute(spec.attr, String(value));
    } else renderer.setProperty(spec.name, value);
  }
  renderer.connectedCallback();
  context.customElementInstanceStack.push(renderer);
  context.customElementHostStack.push(renderer);
  const output = renderer.renderShadow(context);
  const { mode = 'open', delegatesFocus } = renderer.shadowRootOptions;
  const templateAttributes: Record<string, string> = { shadowrootmode: mode };
  if (delegatesFocus) templateAttributes.shadowrootdelegatesfocus = '';
  const contents = output ? collectResultSync(output) : undefined;
  return {
    attributes: Object.fromEntries(
      Array.from(renderer.element?.attributes ?? [], ({ name, value }) => [name, value]),
    ),
    shadowRoot: contents === undefined ? undefined : { attributes: templateAttributes, contents },
    shadowHtml:
      contents === undefined
        ? ''
        : `<template shadowrootmode="${mode}"${delegatesFocus ? ' shadowrootdelegatesfocus' : ''}>${contents}</template>`,
  };
}
