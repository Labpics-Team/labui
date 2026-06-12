// Vue 3 SSR entry. Renders App to an HTML string the way any vue-vite SSR setup
// does (renderToString). The Lit-SSR DSD string is rendered on the server too
// and threaded in as a prop, proving the meta-framework can carry it.
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { renderButtonsToString } from '../shared/render-button.mjs';
// @ts-expect-error - .vue SFC type resolved by the vue plugin at build time
import App from './App.vue';

export async function render(): Promise<string> {
  const litSsrHtml = renderButtonsToString();
  const app = createSSRApp(App, { litSsrHtml });
  // Vue must treat lab-button as a custom element, not a Vue component.
  app.config.compilerOptions = { isCustomElement: (tag) => tag === 'lab-button' };
  return await renderToString(app);
}
