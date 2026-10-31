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
 * DOM окружение принадлежит этому SSR-входу. Уже созданный Lit или приложением
 * реестр сохраняется, в том числе при импорте компонентов раньше SSR.
 */
import { render } from '@lit-labs/ssr';
import { installWindowOnGlobal } from '@lit-labs/ssr/lib/dom-shim.js';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import { type TemplateResult, html } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

// Auto-install ждёт CSS loader hook и может заменить registry, пока соседние
// ESM-модули уже регистрируют компоненты. CSS LabUI включён в их определения;
// достаточно синхронного DOM API с сохранением единственного реестра.
installWindowOnGlobal({ customElements: globalThis.customElements });

/**
 * Render a Lit template to a declarative-shadow-DOM HTML string.
 *
 * The caller is responsible for having imported the element module(s) the
 * template uses so they are registered. Returns a complete HTML string ready
 * to embed via any framework's raw-HTML slot.
 */
export function renderToString(template: TemplateResult): string {
  return collectResultSync(render(template));
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
