/**
 * Рендер реальных `.astro`-компонентов через Astro Container API: серверный вывод несёт
 * declarative shadow DOM (set:html) + клиентский <script> гидрации. 3 репрезентативных
 * компонента (button со слотом, input, dialog). Это проверяет саму `.astro`-обёртку.
 */
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import Button from '../src/astro/Button.astro';
import Dialog from '../src/astro/Dialog.astro';
import Input from '../src/astro/Input.astro';

describe('Astro .astro-компоненты (Container API)', () => {
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

  it('Dialog.astro: DSD с заголовком', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Dialog, { props: { heading: 'Заголовок' } });
    expect(html).toContain('shadowrootmode');
    expect(html).toContain('lab-dialog');
  });
});
