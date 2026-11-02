import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

// Нужен предшествующий pnpm build, как в штатной CI: проверяем поставляемые exports.
const packages = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

beforeAll(() => {
  const map = JSON.parse(readFileSync(resolve(packages, 'core/dist/ssr/index.js.map'), 'utf8'));
  const source = readFileSync(resolve(packages, 'core/src/ssr/index.ts'), 'utf8');
  expect(
    map.sourcesContent,
    'SSR dist устарел: выполните pnpm build перед проверкой exports',
  ).toContain(source);
});

function run(consumer: string, source: string) {
  // Свежий процесс не наследует прогретый registry Vitest или SSR других тестов.
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: resolve(packages, consumer),
    encoding: 'utf8',
    timeout: 20_000,
    windowsHide: true,
  });
  expect(child.error, child.stderr).toBeUndefined();
  expect(child.status, child.stderr).toBe(0);
  return JSON.parse(child.stdout.trim());
}

describe('собранные SSR-входы: регистрация без предварительных импортов', () => {
  for (const adapter of ['vue', 'solid', 'svelte', 'astro']) {
    it(`${adapter}: boolean SSR отличает пропущенный current от явного false`, () => {
      const result = run(
        adapter,
        `import { renderSwitch, renderCheckbox } from '@labpics/ui-${adapter}/ssr';
const state = (markup, tag) => {
  const start = markup.indexOf('<' + tag);
  const host = start < 0 ? undefined : markup.slice(start, markup.indexOf('>', start) + 1);
  if (!host || !markup.includes('shadowrootmode')) throw new Error('Missing SSR host or shadow root');
  return { checked: /\\schecked(?:[\\s=>])/.test(host), mixed: /\\sindeterminate(?:[\\s=>])/.test(host) };
};
console.log(JSON.stringify([
  state(renderSwitch({defaultChecked: true}), 'lab-switch'),
  state(renderSwitch({defaultChecked: true, checked: false}), 'lab-switch'),
  state(renderCheckbox({defaultIndeterminate: true}), 'lab-checkbox'),
  state(renderCheckbox({defaultIndeterminate: true, indeterminate: false}), 'lab-checkbox'),
]));`,
      );
      expect(result).toEqual([
        { checked: true, mixed: false },
        { checked: false, mixed: false },
        { checked: false, mixed: true },
        { checked: false, mixed: false },
      ]);
    });

    it(`${adapter}: cold static import создаёт настоящий Shadow DOM`, () => {
      const result = run(
        adapter,
        `import { renderButton } from '@labpics/ui-${adapter}/ssr';
const markup = renderButton({ description: 'Description' }, {
  default: 'Button', icon: '<span>Start</span>', end: '<span>End</span>',
});
console.log(JSON.stringify({
  entry: import.meta.resolve('@labpics/ui-${adapter}/ssr'),
  registered: !!customElements.get('lab-button'),
  dsd: markup.includes('shadowrootmode'),
  native: markup.includes('<button'),
  description: markup.includes('class="description"'),
  slots: markup.includes('slot="icon"') && markup.includes('slot="end"'),
}));`,
      );
      expect(result.entry).toContain('/dist/');
      expect(result).toMatchObject({
        registered: true,
        dsd: true,
        native: true,
        description: true,
        slots: true,
      });
    });
  }

  it('сохраняет registry и компоненты, зарегистрированные до SSR', () => {
    expect(
      run(
        'vue',
        `const { LabButton } = await import('@labpics/ui-core/button');
const registry = customElements;
class ExistingElement extends LabButton {}
registry.define('consumer-existing', ExistingElement);
const { renderButton } = await import('@labpics/ui-vue/ssr');
console.log(JSON.stringify({
  registry: registry === customElements,
  existing: customElements.get('consumer-existing') === ExistingElement,
  button: customElements.get('lab-button') === LabButton,
  dsd: renderButton({}, {default: 'Button'}).includes('shadowrootmode'),
}));`,
      ),
    ).toEqual({ registry: true, existing: true, button: true, dsd: true });
  });

  it('сохраняет последовательный импорт SSR → адаптер', () => {
    expect(
      run(
        'vue',
        `await import('@labpics/ui-core/ssr');
const { renderButton } = await import('@labpics/ui-vue/ssr');
console.log(JSON.stringify({dsd: renderButton({}, {default: 'Button'}).includes('shadowrootmode')}));`,
      ),
    ).toEqual({ dsd: true });
  });

  it('сохраняет native fetch при холодном импорте адаптера', () => {
    expect(
      run(
        'vue',
        `const originalFetch = globalThis.fetch;
const { renderButton } = await import('@labpics/ui-vue/ssr');
const markup = renderButton({}, {default: 'Button'});
console.log(JSON.stringify({
  fetch: globalThis.fetch === originalFetch,
  dsd: markup.includes('shadowrootmode'),
  native: markup.includes('<button'),
}));`,
      ),
    ).toEqual({ fetch: true, dsd: true, native: true });
  });

  it('сохраняет host fetch и registry при смешанном ESM → CJS импорте', () => {
    expect(
      run(
        'vue',
        `import { createRequire } from 'node:module';
const originalFetch = globalThis.fetch;
const hostFetch = (...args) => originalFetch(...args);
globalThis.fetch = hostFetch;
const { renderButton } = await import('@labpics/ui-vue/ssr');
const esmFetch = globalThis.fetch === hostFetch;
const registry = customElements;
const Button = registry.get('lab-button');
class ExistingElement extends Button {}
registry.define('consumer-existing', ExistingElement);
const esmMarkup = renderButton({}, {default: 'Button'});
globalThis.fetch = hostFetch;
const { html, renderToString } = createRequire(import.meta.url)('@labpics/ui-core/ssr');
const cjsMarkup = renderToString(html\`<lab-button>Button</lab-button>\`);
console.log(JSON.stringify({
  esmFetch,
  cjsFetch: globalThis.fetch === hostFetch,
  registry: customElements === registry,
  existing: customElements.get('consumer-existing') === ExistingElement,
  button: customElements.get('lab-button') === Button,
  esmDsd: esmMarkup.includes('shadowrootmode'),
  cjsDsd: cjsMarkup.includes('shadowrootmode'),
  cjsNative: cjsMarkup.includes('<button'),
}));`,
      ),
    ).toEqual({
      esmFetch: true,
      cjsFetch: true,
      registry: true,
      existing: true,
      button: true,
      esmDsd: true,
      cjsDsd: true,
      cjsNative: true,
    });
  });
});
