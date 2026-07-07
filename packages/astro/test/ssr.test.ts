/**
 * SSR-смоук: `renderX` из `@labpics/ui-astro/ssr` рендерит <lab-*> в declarative
 * shadow DOM (строка содержит `shadowrootmode`). 3 репрезентативных компонента.
 */
import { describe, expect, it } from 'vitest';
import { renderButton, renderDialog, renderInput } from '../src/ssr.js';

describe('Astro SSR (declarative shadow DOM)', () => {
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
