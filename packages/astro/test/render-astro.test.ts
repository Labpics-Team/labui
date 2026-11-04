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
import Checkbox from '@labpics/ui-astro/Checkbox.astro';
import Switch from '@labpics/ui-astro/Switch.astro';
import { renderCheckbox, renderSwitch } from '@labpics/ui-astro/ssr';

const compiled = import.meta.glob('../src/astro/*.astro', { eager: true });

describe('Astro .astro-компоненты (Container API)', () => {
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
      expect(markup).toContain(render(props));
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
