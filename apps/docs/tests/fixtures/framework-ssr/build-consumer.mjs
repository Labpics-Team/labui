import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename } from 'node:path';
import { build } from 'esbuild';
import { compile } from 'svelte/compiler';
import { createServer } from 'vite';
import { compileScript, parse } from 'vue/compiler-sfc';

const compileComponent = (source, path, server) =>
  path.endsWith('.vue')
    ? compileScript(parse(source, { filename: path }).descriptor, {
        id: basename(path),
        inlineTemplate: true,
        templateOptions: { ssr: server },
      }).content
    : compile(source, { filename: path, generate: server ? 'server' : 'client', dev: true }).js
        .code;
const compiler = (server) => ({
  name: 'framework-fixtures',
  setup(build) {
    build.onLoad({ filter: /\.(?:vue|svelte)$/ }, async ({ path }) => ({
      contents: compileComponent(await readFile(path, 'utf8'), path, server),
      loader: 'js',
    }));
  },
});
const frameworks = {
  vue: {
    server: `import {createSSRApp} from 'vue';import {renderToString} from 'vue/server-renderer';import App from './VueApp.vue';export const html=await renderToString(createSSRApp(App));`,
    hydrate: `import {createSSRApp,nextTick} from 'vue';import App from './VueApp.vue';export async function mount(){createSSRApp(App).mount('#app');await nextTick()}`,
  },
  solid: {
    server: `import {renderToString,generateHydrationScript} from 'solid-js/web';import {createComponent} from 'solid-js';import {App} from './solid-app.mjs';export const html=renderToString(()=>createComponent(App,{}));export const hydrationScript=generateHydrationScript();`,
    hydrate: `import {hydrate} from 'solid-js/web';import {createComponent} from 'solid-js';import {App} from './solid-app.mjs';export function mount(){hydrate(()=>createComponent(App,{}),document.getElementById('app'))}`,
  },
  svelte: {
    server: `import {render} from 'svelte/server';import App from './SvelteApp.svelte';export const html=render(App).body;`,
    hydrate: `import {hydrate,flushSync} from 'svelte';import App from './SvelteApp.svelte';export function mount(){hydrate(App,{target:document.getElementById('app')});flushSync()}`,
  },
};
// Qualify both server module formats in the same registry, with CJS registering first.
const require = createRequire(import.meta.url);
const vue = require('vue');
const vueSsr = require('vue/server-renderer');
const cjsVue = await vueSsr.renderToString(
  vue.createSSRApp({
    render: () =>
      vue.h(require('@labpics/ui-vue/tabs').Tabs, {
        items: [{ value: 'a', label: 'A' }],
        value: null,
      }),
  }),
);
assert(cjsVue.includes('shadowrootmode'));
assert(cjsVue.includes('&quot;value&quot;:null'));
const solid = require('solid-js');
const solidWeb = require('solid-js/web');
const cjsSolid = solidWeb.renderToString(() =>
  solid.createComponent(require('@labpics/ui-solid/tabs').Tabs, {
    items: [{ value: 'a', label: 'A' }],
    value: null,
  }),
);
assert(cjsSolid.includes('shadowrootmode'));
const records = [];
for (const [name, source] of Object.entries(frameworks)) {
  await mkdir(`web/${name}`, { recursive: true });
  await writeFile(`${name}-server.mjs`, source.server);
  await writeFile(`${name}-hydrate.mjs`, source.hydrate);
  await writeFile(
    `${name}-client.mjs`,
    `
    import '@labui/colors/contract.css';
    import '@labpics/ui-tokens/tokens.css';
    import '@labpics/ui-tokens/motion.css';
    import '@labpics/ui-core/theme.css';
    import '@labpics/ui-core/shadow.css';
    import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
    window.hydrate=async()=>{
      const {mount}=await import('./${name}-hydrate.mjs');await mount();
      await Promise.all([...document.querySelectorAll('*')].filter(x=>x.localName.startsWith('lab-')).map(x=>x.updateComplete));
      window.hydrated=true;
    };
  `,
  );
  const server = await build({
    entryPoints: [`${name}-server.mjs`],
    outfile: `server/${name}.mjs`,
    bundle: true,
    format: 'esm',
    platform: 'node',
    conditions: ['development'],
    tsconfigRaw: {},
    plugins: [compiler(true)],
    metafile: true,
    external: [
      'vue',
      'vue/*',
      'solid-js',
      'solid-js/*',
      'svelte',
      'svelte/*',
      '@labpics/ui-core',
      '@labpics/ui-core/*',
      '@labpics/ui-vue',
      '@labpics/ui-vue/*',
      '@labpics/ui-solid',
      '@labpics/ui-solid/*',
    ],
  });
  const browser = await build({
    entryPoints: [`${name}-client.mjs`],
    outdir: `web/${name}`,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    splitting: true,
    conditions: ['development'],
    tsconfigRaw: {},
    plugins: [compiler(false)],
    metafile: true,
    define: {
      __VUE_OPTIONS_API__: 'true',
      __VUE_PROD_DEVTOOLS__: 'false',
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'true',
    },
  });
  const inputs = Object.keys(browser.metafile.inputs);
  assert(!inputs.some((x) => /@lit-labs\/ssr\//.test(x)), `${name}: server engine entered browser`);
  assert(
    !inputs.some((x) => /ui-core\/dist\/ssr\/element\.js$/.test(x)),
    `${name}: server provider entered browser`,
  );
  const browserProviders = inputs.filter((x) => /ui-core\/dist\/ssr\/element-browser\.js$/.test(x));
  assert.equal(browserProviders.length, 1, `${name}: browser provider must resolve once`);
  assert(
    !inputs.some((x) => /packages\/(core|vue|solid|svelte)\/src\//.test(x)),
    `${name}: workspace aliases substituted installed dist`,
  );
  const rendered = await import(`./server/${name}.mjs`);
  assert(
    rendered.html.includes('shadowrootmode'),
    `${name}: expected DSD; got ${rendered.html.slice(0, 500)}`,
  );
  assert(rendered.html.includes('Server draft'));
  await writeFile(
    `web/${name}/index.html`,
    `<!doctype html><html data-theme="light"><head><meta charset="utf-8">${rendered.hydrationScript ?? ''}<link rel="stylesheet" href="/${name}/${name}-client.css"><style>body{margin:24px;font-family:system-ui}main{display:grid;gap:20px;max-width:640px}main>button{justify-self:start;min-height:36px}</style></head><body><div id="app">${rendered.html}</div><script type="module" src="/${name}/${name}-client.js"></script></body></html>`,
  );
  await writeFile(`web/${name}/browser-metafile.json`, JSON.stringify(browser.metafile));
  await writeFile(`web/${name}/server-metafile.json`, JSON.stringify(server.metafile));
  records.push({
    name,
    browserModules: inputs.length,
    browserProviders,
    serverEngineInBrowser: false,
  });
}
// Exercise Vite's actual SSR resolver as well as Node's package exports.
const vite = await createServer({
  root: process.cwd(),
  configFile: false,
  appType: 'custom',
  server: { middlewareMode: true },
  ssr: { noExternal: ['@labpics/ui-svelte'] },
  plugins: [
    {
      name: 'framework-fixtures',
      enforce: 'pre',
      transform(code, id, options) {
        const path = id.split('?')[0];
        if (!/\.(vue|svelte)$/.test(path)) return;
        return { code: compileComponent(code, path, options?.ssr ?? false), map: null };
      },
    },
  ],
});
try {
  for (const name of Object.keys(frameworks)) {
    const { html } = await vite.ssrLoadModule(`/${name}-server.mjs`);
    assert(html.includes('shadowrootmode'), `${name}: Vite SSR did not render the element`);
    assert(html.includes('Server draft'), `${name}: Vite SSR lost native slots`);
  }
} finally {
  await vite.close();
}
await writeFile(
  'qualification.json',
  JSON.stringify(
    { records, nodeEsm: ['vue', 'solid', 'svelte'], nodeCjs: ['vue', 'solid'], viteSsr: true },
    null,
    2,
  ),
);
console.info('Installed Node ESM/CJS, Vite SSR and browser isolation passed');
