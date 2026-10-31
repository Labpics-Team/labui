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
});
