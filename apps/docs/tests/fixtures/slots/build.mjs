import { readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { compile } from 'svelte/compiler';

const compiler = (server) => ({
  name: 'svelte',
  setup(build) {
    build.onLoad({ filter: /\.svelte$/ }, async ({ path }) => ({
      contents: compile(await readFile(path, 'utf8'), {
        filename: path,
        generate: server ? 'server' : 'client',
        dev: true,
      }).js.code,
      loader: 'js',
    }));
  },
});
const styles =
  "import '@labpics/fonts/fonts.css';import '@labui/colors/contract.css';import '@labpics/ui-core/tokens.css';import '@labpics/ui-materials/material.css';";
for (const name of ['vue', 'svelte']) {
  const server =
    name === 'vue'
      ? "import {createSSRApp} from 'vue';import {renderToString} from 'vue/server-renderer';import App from './vue-app.mjs';export const html=await renderToString(createSSRApp(App));"
      : "import {render} from 'svelte/server';import App from './SvelteApp.svelte';export const html=render(App).body;";
  const client =
    name === 'vue'
      ? "import {createApp,createSSRApp,nextTick} from 'vue';import App from './vue-app.mjs';export async function run(ssr){(ssr?createSSRApp(App):createApp(App)).mount('#app');await nextTick()}"
      : "import {mount,hydrate,flushSync} from 'svelte';import App from './SvelteApp.svelte';export async function run(ssr){(ssr?hydrate:mount)(App,{target:document.querySelector('#app')});flushSync()}";
  await writeFile(`${name}-server.mjs`, server);
  await writeFile(`${name}-hydrate.mjs`, client);
  await writeFile(
    `${name}-client.mjs`,
    `${styles}import '@lit-labs/ssr-client/lit-element-hydrate-support.js';customElements.define('demo-symbol',class extends HTMLElement{connectedCallback(){if(!this.shadowRoot)this.attachShadow({mode:'open'}).innerHTML='<style>:host{display:block}svg{display:block;width:100%;height:100%}</style><svg width=24 height=24 viewBox=\"0 0 24 24\"><circle cx=12 cy=12 r=8/></svg>'}});window.hydrate=async(ssr)=>{const {run}=await import('./${name}-hydrate.mjs');await run(ssr);window.ready=true};`,
  );
  await build({
    entryPoints: [`${name}-server.mjs`],
    outfile: `server/${name}.mjs`,
    bundle: true,
    format: 'esm',
    platform: 'node',
    conditions: ['development'],
    plugins: [compiler(true)],
    external: [
      'vue',
      'vue/*',
      'svelte',
      'svelte/*',
      '@labpics/ui-core',
      '@labpics/ui-core/*',
      '@labpics/ui-vue',
      '@labpics/ui-vue/*',
    ],
  });
  const { html } = await import(`./server/${name}.mjs`);
  await build({
    entryPoints: [`${name}-client.mjs`],
    outdir: 'public',
    bundle: true,
    format: 'esm',
    platform: 'browser',
    conditions: ['development'],
    plugins: [compiler(false)],
    loader: { '.woff2': 'file', '.woff': 'file', '.ttf': 'file' },
    define: {
      __VUE_OPTIONS_API__: 'true',
      __VUE_PROD_DEVTOOLS__: 'false',
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'true',
    },
  });
  for (const ssr of [true, false])
    await writeFile(
      `public/${name}-${ssr}.html`,
      `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><link rel="stylesheet" href="/${name}-client.css"><style>body{margin:24px;font-family:Geist}#app{display:grid;gap:16px;width:600px}input{max-width:100px}</style></head><body><div id="app">${ssr ? html : ''}</div><script type="module" src="/${name}-client.js"></script></body></html>`,
    );
}
