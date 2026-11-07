import Checkbox from '@labpics/ui-astro/Checkbox.astro';
import Switch from '@labpics/ui-astro/Switch.astro';
import { renderCheckbox, renderSwitch } from '@labpics/ui-astro/ssr';
/**
 * Рендер реальных `.astro`-компонентов через Astro Container API: серверный вывод несёт
 * declarative shadow DOM (set:html) + клиентский <script> гидрации. 3 репрезентативных
 * компонента (button со слотом, input, dialog). Это проверяет саму `.astro`-обёртку.
 */
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import manifest from '../../adapter-codegen/manifest.generated.json';
import Button from '../src/astro/Button.astro';
import Dialog from '../src/astro/Dialog.astro';
import Input from '../src/astro/Input.astro';

const compiled = import.meta.glob('../src/astro/*.astro', { eager: true });

// Два независимых SSR-render создают разные instance IDs. Сохраняем части
// label-start/label-end и все их ссылки, сравнивая остальной фрагмент целиком.
function canonicalInstanceIds(markup: string): string {
  const instances = new Map<string, string>();
  return markup.replace(/\blab-[0-9a-z]+(?=-label-(?:start|end)\b)/g, (prefix) => {
    const canonical = instances.get(prefix) ?? `lab-instance-${instances.size}`;
    instances.set(prefix, canonical);
    return canonical;
  });
}

describe('Astro .astro-компоненты (Container API)', () => {
  it('SSR-сравнение сохраняет связь ID и ссылки при смене instance prefix', () => {
    const first = '<span id="lab-0-label-start"></span><input aria-labelledby="lab-0-label-start">';
    const renamed = first.replaceAll('lab-0', 'lab-9');
    const dangling = first.replace('aria-labelledby="lab-0', 'aria-labelledby="lab-9');
    expect(canonicalInstanceIds(first)).toBe(canonicalInstanceIds(renamed));
    expect(canonicalInstanceIds(first)).not.toBe(canonicalInstanceIds(dangling));
  });

  it('boolean: публичные .astro сохраняют тот же SSR-фрагмент для current=false и defaults', async () => {
    const container = await AstroContainer.create();
    for (const [component, render, props] of [
      [Switch, renderSwitch, { defaultChecked: true }],
      [Switch, renderSwitch, { defaultChecked: true, checked: false }],
      [Checkbox, renderCheckbox, { defaultIndeterminate: true }],
      [Checkbox, renderCheckbox, { defaultIndeterminate: true, indeterminate: false }],
    ] as const) {
      const markup = await container.renderToString(component, { props });
      // Публичный Astro-мост должен сохранить именно фрагмент общего SSR-входа.
      expect(canonicalInstanceIds(markup)).toContain(canonicalInstanceIds(render(props)));
      expect(markup).toMatch(/<script[^>]*type="module"/);
      const host = markup.match(/<lab-(?:switch|checkbox)\b[^>]*>/)?.[0];
      expect(host).toBeDefined();
      const explicitFalse = 'checked' in props || 'indeterminate' in props;
      expect(/\schecked(?:[\s=>])/.test(host ?? '')).toBe(
        !explicitFalse && 'defaultChecked' in props,
      );
      expect(/\sindeterminate(?:[\s=>])/.test(host ?? '')).toBe(
        !explicitFalse && 'defaultIndeterminate' in props,
      );
    }
  });

  it('каждая обёртка из манифеста компилируется Astro', () => {
    const expected = manifest.components.map((c) => `../src/astro/${c.pascal}.astro`).sort();
    expect(Object.keys(compiled).sort()).toEqual(expected);
  });

  it('Button.astro: DSD + контент слота + client-скрипт гидрации', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Button, {
      props: { type: 'accent', description: 'Изменения' },
      slots: { default: 'Сохранить', icon: '<i>Слева</i>', end: '<i>Справа</i>' },
    });
    expect(html).toContain('shadowrootmode');
    expect(html).toContain('lab-button');
    expect(html).toContain('Сохранить');
    expect(html).toContain('Изменения');
    const markup = html.replace(/<!--[\s\S]*?-->/g, '');
    expect(markup).toContain('<span slot="icon"><i>Слева</i></span>');
    expect(markup).toContain('<span slot="end"><i>Справа</i></span>');
    // Клиентский <script type="module"> эмитится (Astro экстернализует его содержимое —
    // hydrate-support + регистрация элемента — в отдельный чанк, поэтому проверяем факт
    // наличия скрипта гидрации, а не его тело).
    expect(html).toMatch(/<script[^>]*type="module"/);
  });

  it('Input.astro: реальный <input> в DSD', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Input, { props: { label: 'Имя' } });
    expect(html).toContain('shadowrootmode');
    expect(html).toContain('<input');
  });

  it('Dialog.astro: DSD с заголовком', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Dialog, { props: { heading: 'Заголовок' } });
    expect(html).toContain('shadowrootmode');
    expect(html).toContain('lab-dialog');
  });
});
