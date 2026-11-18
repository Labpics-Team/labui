import { render } from '@lit-labs/ssr';
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
import { installWindowOnGlobal } from '@lit-labs/ssr/lib/dom-shim.js';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import { type TemplateResult, html, noChange } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

// The upstream install-global entry awaits its optional CSS import hook. Static
// sibling component imports can then execute before customElements exists and
// silently skip registration. LabUI ships CSS strings and files, not CSS module
// imports: install its required DOM globals synchronously before this entry
// completes, so generated synchronous SSR adapters can register their elements.
// SSR 4.1's window shim has no window self-reference; a caller may
// therefore already have its registry installed while globalThis.window is absent.
installWindowOnGlobal(typeof customElements === 'undefined' ? {} : { customElements });

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
 * `ifDefined` omits undefined attributes, `noChange` preserves constructor defaults
 * for omitted properties, and `unsafeHTML` injects pre-rendered slot content.
 */
export { html, ifDefined, noChange, unsafeHTML };
export type { TemplateResult };
