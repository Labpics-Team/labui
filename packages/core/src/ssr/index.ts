/**
 * Lit SSR shim — the ~10-line per-stack wiring the spike (spike-FINDINGS.md)
 * identified as the cost of WC deep-SSR on Vue/Svelte/Solid/Astro.
 *
 * WC deep-SSR is a property of `@lit-labs/ssr`, not of the host framework: every
 * SSR framework that can emit a raw HTML string carries the declarative shadow
 * DOM (DSD) through intact → styled first paint, no FOUC. This module renders a
 * Lit template to that DSD-bearing string once; each meta-framework adapter
 * injects the string with its own raw-HTML mechanism (Vue `v-html`, Svelte
 * `{@html}`, Solid `innerHTML`, Astro's built-in `@astrojs/lit`).
 *
 * It lives behind the `@labpics/ui-core/ssr` entry and lists `@lit-labs/ssr` as
 * an OPTIONAL peer, so a consumer that never server-renders the Lit path (e.g.
 * the React renderer, which SSRs natively) never pulls the SSR engine into its
 * bundle. The React path does not import this file at all.
 *
 * The DOM shim MUST be installed before any custom element module is imported,
 * so element registration works in Node. Import order is load-bearing — keep
 * the shim import first.
 */
import '@lit-labs/ssr/lib/install-global-dom-shim.js';
import { render } from '@lit-labs/ssr';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import { type TemplateResult, html } from 'lit';

/**
 * Render a Lit template to a declarative-shadow-DOM HTML string.
 *
 * The caller is responsible for having imported the element module(s) the
 * template uses (after this module's shim import has run) so they are
 * registered. Returns a complete HTML string ready to embed via any framework's
 * raw-HTML slot.
 */
export function renderToString(template: TemplateResult): string {
  return collectResultSync(render(template));
}

/**
 * Re-exported so SSR callers can author templates without a direct `lit`
 * dependency — the SSR entry is the one place a non-Lit host touches Lit at all.
 */
export { html };
export type { TemplateResult };
