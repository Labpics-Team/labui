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
 * Node-экспорты Lit сами создают минимальные DOM-типы и customElements.
 * Полный install-global-dom-shim здесь не нужен: его асинхронный CSS-loader
 * делает CJS недоступным и может заменить registry после регистрации элементов.
 */
import { render } from '@lit-labs/ssr';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import { type TemplateResult, html } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { shapeCardRegions } from '../components/card/ssr.js';

/**
 * Render a Lit template to a declarative-shadow-DOM HTML string.
 *
 * Вызывающий код импортирует модули элементов шаблона, чтобы они зарегистрировались
 * в общем Node-registry Lit. Результат можно вставить через raw-HTML API фреймворка.
 */
export function renderToString(template: TemplateResult): string {
  return shapeCardRegions(collectResultSync(render(template)));
}

/**
 * Re-exported so SSR callers can author templates without a direct `lit`
 * dependency — the SSR entry is the one place a non-Lit host touches Lit at all.
 * `ifDefined` (omit an attribute when its value is undefined) and `unsafeHTML`
 * (inject a pre-rendered raw HTML string as slotted light-DOM content) are the two
 * directives the framework adapters' generated SSR helpers need to author a
 * `<lab-*>` template, so they ship from this single SSR surface too.
 */
export { html, ifDefined, unsafeHTML };
export type { TemplateResult };
