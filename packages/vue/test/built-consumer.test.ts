import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';
import { build } from 'tsup';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const packages = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const consumer = mkdtempSync(join(tmpdir(), 'labui-built-consumer-'));

// CI собирает пакеты до pnpm test. Копируем только поставляемые файлы; резолюция
// идёт через exports без Vitest/tsconfig aliases и доступа к исходникам Core/Vue.
beforeAll(() => {
  const local = new Set(['@labpics/ui-core', '@labpics/ui-vue']);
  const linked = new Set<string>();
  writeFileSync(join(consumer, 'package.json'), '{"private":true,"type":"module"}');
  writeFileSync(join(consumer, 'tsconfig.json'), '{}');
  for (const folder of ['core', 'vue']) {
    const source = join(packages, folder);
    const manifest = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8')) as {
      name: string;
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    const target = join(consumer, 'node_modules', manifest.name);
    mkdirSync(target, { recursive: true });
    cpSync(join(source, 'dist'), join(target, 'dist'), { recursive: true });
    cpSync(join(source, 'package.json'), join(target, 'package.json'));
    for (const name of Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies })) {
      if (local.has(name) || linked.has(name)) continue;
      const link = join(consumer, 'node_modules', name);
      mkdirSync(dirname(link), { recursive: true });
      symlinkSync(realpathSync(join(source, 'node_modules', name)), link, 'junction');
      linked.add(name);
    }
  }
});

afterAll(() => {
  rmSync(consumer, { recursive: true, force: true });
});

describe('собранные Core/Vue-пакеты у потребителя', () => {
  it.each(['module', 'commonjs'] as const)(
    'холодный %s import самостоятельно создаёт DSD',
    (mode) => {
      const load =
        mode === 'module'
          ? "import {renderCard,renderBadge} from '@labpics/ui-vue/ssr';"
          : "const {renderCard,renderBadge}=require('@labpics/ui-vue/ssr');";
      const result = spawnSync(
        process.execPath,
        [
          `--input-type=${mode}`,
          '-e',
          `${load}
          console.log(JSON.stringify({
            card: renderCard({heading:'Заголовок'}).includes('shadowrootmode="open"'),
            badge: renderBadge({}, {default:'Метка'}).includes('shadowrootmode="open"'),
            registered: Boolean(globalThis.customElements?.get('lab-badge'))
          }));`,
        ],
        { cwd: consumer, encoding: 'utf8', timeout: 10_000 },
      );
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({ card: true, badge: true, registered: true });
    },
    15_000,
  );

  it.each(['module', 'commonjs'] as const)(
    'прямой Core %s import сохраняет вложенную регистрацию Badge',
    (mode) => {
      const load =
        mode === 'module'
          ? "import {renderToString,html} from '@labpics/ui-core/ssr'; import '@labpics/ui-core/card';"
          : "const {renderToString,html}=require('@labpics/ui-core/ssr'); require('@labpics/ui-core/card');";
      const result = spawnSync(
        process.execPath,
        [
          `--input-type=${mode}`,
          '-e',
          `${load}
          const output = renderToString(html\`<lab-card badge="Метка" heading="Заголовок"></lab-card>\`);
          console.log(JSON.stringify({
            roots: output.match(/shadowrootmode="open"/g)?.length ?? 0,
            registered: Boolean(globalThis.customElements?.get('lab-badge'))
          }));`,
        ],
        { cwd: consumer, encoding: 'utf8', timeout: 10_000 },
      );
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({ roots: 2, registered: true });
    },
    15_000,
  );

  it('production tree-shaking сохраняет регистрацию и shadowRoot Badge', async () => {
    const entry = join(consumer, 'browser.mjs');
    const output = join(consumer, 'bundle');
    writeFileSync(
      entry,
      `import {createApp,h} from 'vue';
       import {Badge} from '@labpics/ui-vue/badge';
       createApp({render:()=>h(Badge,{},()=> 'Метка')}).mount('#app');`,
    );
    await build({
      config: false,
      tsconfig: join(consumer, 'tsconfig.json'),
      entry: [entry.replaceAll('\\', '/')],
      outDir: output,
      format: ['iife'],
      platform: 'browser',
      bundle: true,
      minify: true,
      splitting: false,
      sourcemap: false,
      dts: false,
      silent: true,
      noExternal: [/.*/],
      define: { 'process.env.NODE_ENV': '"production"' },
      esbuildOptions(options) {
        options.treeShaking = true;
      },
    });
    const window = new Window({ settings: { enableJavaScriptEvaluation: true } });
    try {
      window.document.body.innerHTML = '<div id="app"></div>';
      window.eval(readFileSync(join(output, 'browser.global.js'), 'utf8'));
      const badge = window.document.querySelector('lab-badge');
      expect(window.customElements.get('lab-badge')).toBeDefined();
      expect(badge).not.toBeNull();
      await (badge as unknown as { updateComplete: Promise<boolean> }).updateComplete;
      expect(badge?.shadowRoot?.querySelector('[part="badge"]')).not.toBeNull();
    } finally {
      await window.happyDOM.close();
    }
  }, 20_000);
});
