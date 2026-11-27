/**
 * SSR-смоук: `renderX` из `@labpics/ui-astro/ssr` рендерит <lab-*> в declarative
 * shadow DOM (строка содержит `shadowrootmode`). 3 репрезентативных компонента.
 */
import { describe, expect, it } from 'vitest';
import {
  renderButton,
  renderChoicebox,
  renderDialog,
  renderInput,
  renderRadioGroup,
} from '../src/ssr.js';

describe('Astro SSR (declarative shadow DOM)', () => {
  it('selection keeps omitted defaults and explicit values, including the empty radio value', () => {
    const radio = renderRadioGroup({
      items: [
        { value: '', label: 'Без имени' },
        { value: 'b', label: 'Второй' },
      ],
      defaultValue: '',
    });
    expect(
      radio.match(/<input\b[^>]*>/g)?.filter((input) => /\schecked(?:\s|>)/.test(input)),
    ).toHaveLength(1);
    const choice = renderChoicebox(
      {
        items: [{ value: 'b', label: 'Второй' }],
        defaultValue: ['b'],
      },
      { dynamic: { 'label-b': '<strong>Подпись</strong>', 'description-b': '<em>Описание</em>' } },
    );
    expect(choice.match(/<input\b[^>]*>/)?.[0]).toMatch(/\schecked(?:\s|>)/);
    const markup = choice.replace(/<!--[\s\S]*?-->/g, '');
    expect(markup).toContain('<span slot="label-b"><strong>Подпись</strong></span>');
    expect(markup).toContain('<span slot="description-b"><em>Описание</em></span>');
  });
  it('button рендерится в DSD-строку с shadowrootmode + контент слота', () => {
    const out = renderButton({ type: 'accent' }, { default: 'Сохранить' });
    expect(out).toContain('shadowrootmode');
    expect(out).toContain('lab-button');
    expect(out).toContain('Сохранить');
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
