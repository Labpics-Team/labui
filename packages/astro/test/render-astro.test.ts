/**
 * Рендер реальных `.astro`-компонентов через Astro Container API: серверный вывод несёт
 * declarative shadow DOM (set:html) + клиентский <script> гидрации. 3 репрезентативных
 * компонента (button со слотом, input, dialog). Это проверяет саму `.astro`-обёртку.
 */
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import manifest from '../../adapter-codegen/manifest.generated.json';
import Button from '../src/astro/Button.astro';
import Choicebox from '../src/astro/Choicebox.astro';
import Dialog from '../src/astro/Dialog.astro';
import Input from '../src/astro/Input.astro';

const compiled = import.meta.glob('../src/astro/*.astro', { eager: true });

describe('Astro .astro-компоненты (Container API)', () => {
  it('каждая обёртка из манифеста компилируется Astro', () => {
    const expected = manifest.components.map((c) => `../src/astro/${c.pascal}.astro`).sort();
    expect(Object.keys(compiled).sort()).toEqual(expected);
  });

  it('Button.astro: DSD + контент слота + client-скрипт гидрации', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Button, {
      props: { type: 'accent' },
      slots: { default: 'Сохранить' },
    });
    expect(html).toContain('shadowrootmode');
    expect(html).toContain('lab-button');
    expect(html).toContain('Сохранить');
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

  it('Choicebox.astro forwards item-specific rich slots into the server frame', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Choicebox, {
      props: { items: [{ value: 'a', label: 'Fallback' }] },
      slots: { 'label-a': '<strong>Подпись</strong>', 'description-a': '<em>Описание</em>' },
    });
    expect(html).toContain('slot="label-a"');
    expect(html).toContain('<strong>Подпись</strong>');
    expect(html).toContain('slot="description-a"');
    expect(html).toContain('<em>Описание</em>');
  });

  it('Dialog.astro: DSD с заголовком', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Dialog, { props: { heading: 'Заголовок' } });
    expect(html).toContain('shadowrootmode');
    expect(html).toContain('lab-dialog');
  });
});
