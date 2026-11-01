/**
 * Клиентский маунт-смоук (happy-dom, задаётся vitest.config): обёртка монтирует реальный
 * <lab-*>, пробрасывает пропы атрибутами/свойствами, слоты и кастом-события. 3
 * репрезентативных компонента: button (слоты + булевы), input (свойство value),
 * checkbox (кастом-событие).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h } from 'vue';
import { Badge } from '../src/generated/badge.js';
import { Button } from '../src/generated/button.js';
import { Checkbox } from '../src/generated/checkbox.js';
import { Input } from '../src/generated/input.js';

function mount(node: ReturnType<typeof h>): { host: HTMLElement; unmount: () => void } {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const app = createApp({ render: () => node });
  app.mount(host);
  return { host, unmount: () => app.unmount() };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Vue mount (проброс на <lab-*>)', () => {
  it('Badge сохраняет содержимое, события и размерную коробку именованного слота', () => {
    const clicked = vi.fn();
    const { host, unmount } = mount(
      h(
        Badge,
        {},
        {
          default: () => 'Статус',
          leading: () =>
            h('svg', { width: 24, height: 24, onClick: clicked }, [
              h('path', { d: 'M0 0h24v24H0Z' }),
            ]),
        },
      ),
    );
    const wrapper = host.querySelector<HTMLElement>('[slot="leading"]');
    expect(wrapper?.hasAttribute('data-lab-slot-fill')).toBe(true);
    expect(wrapper?.style.display).toBe('inline-flex');
    expect(wrapper?.querySelector('svg')?.getAttribute('width')).toBe('24');
    wrapper?.querySelector('svg')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clicked).toHaveBeenCalledOnce();
    const directText = [...(host.querySelector('lab-badge')?.childNodes ?? [])]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join('');
    expect(directText).toBe('Статус');
    unmount();
    expect(host.childNodes.length).toBe(0);
  });
  it('button: строковые оси → атрибуты, false-булев снят, слот в light DOM', () => {
    const { host } = mount(
      h(Button, { type: 'accent', size: 'l', disabled: false, loading: true }, () => 'Сохранить'),
    );
    const el = host.querySelector('lab-button');
    expect(el).toBeTruthy();
    expect(el?.getAttribute('type')).toBe('accent');
    expect(el?.getAttribute('size')).toBe('l');
    // disabled=false → атрибут снят (иначе Lit прочитал бы присутствие как true).
    expect(el?.hasAttribute('disabled')).toBe(false);
    // loading=true → атрибут-флаг присутствует.
    expect(el?.hasAttribute('loading')).toBe(true);
    expect(el?.textContent).toContain('Сохранить');
  });

  it('button: html-type маппится на атрибут html-type (camelCase проп)', () => {
    const { host } = mount(h(Button, { htmlType: 'submit' }, () => 'OK'));
    const el = host.querySelector('lab-button');
    expect(el?.getAttribute('html-type')).toBe('submit');
  });

  it('input: value доходит как атрибут, label — тоже', () => {
    const { host } = mount(h(Input, { label: 'Имя', value: 'Даниил' }));
    const el = host.querySelector('lab-input');
    expect(el).toBeTruthy();
    expect(el?.getAttribute('label')).toBe('Имя');
    expect(el?.getAttribute('value')).toBe('Даниил');
  });

  it('checkbox: кастом-событие checked-change доходит до обработчика', () => {
    const onCheckedChange = vi.fn();
    const { host } = mount(h(Checkbox, { onCheckedChange }));
    const el = host.querySelector('lab-checkbox');
    expect(el).toBeTruthy();
    el?.dispatchEvent(new CustomEvent('checked-change', { detail: { checked: true } }));
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange.mock.calls[0]?.[0]).toBeInstanceOf(CustomEvent);
  });
});
