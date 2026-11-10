/**
 * SSR-смоук: `renderX` из `@labpics/ui-solid/ssr` рендерит <lab-*> в declarative
 * shadow DOM (строка содержит `shadowrootmode`), пригодный для внедрения через
 * innerHTML. 3 репрезентативных компонента (button, dialog, input).
 */
import { describe, expect, it } from 'vitest';
import { renderButton, renderDialog, renderInput } from '../src/ssr.js';

describe('Solid SSR (declarative shadow DOM)', () => {
  it('button рендерится в DSD-строку с shadowrootmode + контент слота', () => {
    const out = renderButton(
      { type: 'accent', description: 'Изменения' },
      { default: 'Сохранить', icon: '<i>Слева</i>', end: '<i>Справа</i>' },
    );
    expect(out).toContain('shadowrootmode');
    expect(out).toContain('lab-button');
    expect(out).toContain('Сохранить');
    expect(out).toContain('Изменения');
    const markup = out.replace(/<!--[\s\S]*?-->/g, '');
    expect(markup).toContain('<span slot="icon"><i>Слева</i></span>');
    expect(markup).toContain('<span slot="end"><i>Справа</i></span>');
  });

  it('input рендерит реальный <input> в теневом дереве', () => {
    const out = renderInput({ label: 'Имя' });
    expect(out).toContain('shadowrootmode');
    expect(out).toContain('<input');
  });

  it('dialog рендерит DSD', () => {
    const out = renderDialog({ heading: 'Заголовок' });
    expect(out).toContain('shadowrootmode');
    expect(out).toContain('lab-dialog');
  });
});
