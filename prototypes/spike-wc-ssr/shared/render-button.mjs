// Framework-agnostic Lit SSR core for the spike.
//
// This is the SAME engine (@lit-labs/ssr) that @astrojs/lit uses to give the
// Astro PASS in proto-a-lit. The open matrix question is NOT "can Lit SSR" —
// proto-A already proved it can. The question is whether each meta-framework
// (Vue 3, Svelte 5, Solid) can *embed that DSD-bearing HTML through its own
// SSR pipeline* without the framework stripping or double-escaping it, and
// whether the result is declarative shadow DOM (first-paint, no FOUC).
//
// We render the <lab-button> template via @lit-labs/ssr to a string. Lit's SSR
// emits <template shadowrootmode="open"> with the inner <button>, i.e.
// declarative shadow DOM. Each fixture then injects this string with its own
// raw-HTML mechanism (Vue v-html, Svelte {@html}, Solid innerHTML) and we probe
// the framework's built HTML for the DSD markers.
import '@lit-labs/ssr/lib/install-global-dom-shim.js';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import { render } from '@lit-labs/ssr/lib/render.js';
import { html } from 'lit';

// Importing AFTER the DOM shim so customElements.define inside the module works.
// The vendored lab-button.js is proto-A's compiled output (decorators already
// transpiled) — byte-for-byte the element measured PASS on Astro in proto-A.
const { LabButton } = await import('../vendor/lab-button.js');
void LabButton; // ensure side-effect registration is retained

/**
 * Render the three-button matrix exactly as the Astro fixture does, to a single
 * HTML string containing declarative shadow DOM.
 * @returns {string}
 */
export function renderButtonsToString() {
  const template = html`
    <lab-button type="accent" kind="fill" data-testid="accent-fill">Accent fill</lab-button>
    <lab-button type="danger" kind="border" data-testid="danger-border">Danger</lab-button>
    <lab-button type="neutral" kind="ghost" data-testid="neutral-ghost">Ghost</lab-button>
  `;
  return collectResultSync(render(template));
}
