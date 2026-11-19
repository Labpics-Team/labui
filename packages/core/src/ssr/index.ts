import './environment.js';
import { render } from '@lit-labs/ssr';
/**
 * Low-level whole-template SSR. Native Vue/Solid/Svelte adapters instead use
 * the conditional element-ssr entry, retaining their own hosts and light DOM.
 * Both paths share the renderer specializations in render-context.ts.
 */
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import { type TemplateResult, html, noChange } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { createRenderContext } from './render-context.js';

/**
 * Render a Lit template to a declarative-shadow-DOM HTML string.
 *
 * The caller is responsible for having imported the element module(s) the
 * template uses (after this module's shim import has run) so they are
 * registered. Returns a complete HTML string ready to embed via any framework's
 * raw-HTML slot.
 */
export function renderToString(template: TemplateResult): string {
  return collectResultSync(render(template, createRenderContext()));
}

/**
 * Re-exported so SSR callers can author templates without a direct `lit`
 * dependency — the SSR entry is the one place a non-Lit host touches Lit at all.
 * `ifDefined` omits undefined attributes, `noChange` preserves constructor defaults
 * for omitted properties, and `unsafeHTML` injects pre-rendered slot content.
 */
export { html, ifDefined, noChange, unsafeHTML };
export type { TemplateResult };
