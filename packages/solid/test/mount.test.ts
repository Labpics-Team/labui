/**
 * Клиентский маунт-смоук (happy-dom, задаётся vitest.config): обёртка монтирует реальный
 * <lab-*>, пробрасывает пропы атрибутами/свойствами, слоты и кастом-события. 3
 * репрезентативных компонента: button (слоты + булевы), input (свойство value),
 * checkbox (кастом-событие).
 */
import { createComponent } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '../src/generated/button.js';
import { Checkbox } from '../src/generated/checkbox.js';
import { Input } from '../src/generated/input.js';

const disposers: Array<() => void> = [];

function mount(component: () => unknown): HTMLElement {
  const host = document.createElement('div');
  document.body.appendChild(host);
  disposers.push(render(component as () => Element, host));
  return host;
}

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  document.body.innerHTML = '';
});

describe('Solid mount (проброс на <lab-*>)', () => {
  it('button: строковые оси → атрибуты, false-булев снят, слот в light DOM', () => {
    const host = mount(() =>
      createComponent(Button, {
        type: 'accent',
        size: 'l',
        disabled: false,
        loading: true,
        children: 'Сохранить',
      }),
    );
    const el = host.querySelector('lab-button');
    expect(el).toBeTruthy();
    expect(el?.getAttribute('type')).toBe('accent');
    expect(el?.getAttribute('size')).toBe('l');
    expect(el?.hasAttribute('disabled')).toBe(false);
    expect(el?.hasAttribute('loading')).toBe(true);
    expect(el?.textContent).toContain('Сохранить');
  });

  it('button: html-type маппится на атрибут html-type (camelCase проп)', () => {
    const host = mount(() => createComponent(Button, { htmlType: 'submit', children: 'OK' }));
    expect(host.querySelector('lab-button')?.getAttribute('html-type')).toBe('submit');
  });

  it('input: label доходит как атрибут', () => {
    const host = mount(() => createComponent(Input, { label: 'Имя', value: 'Даниил' }));
    const el = host.querySelector('lab-input');
    expect(el?.getAttribute('label')).toBe('Имя');
    expect(el?.getAttribute('value')).toBe('Даниил');
  });

  it('checkbox: кастом-событие checked-change доходит до обработчика', () => {
    const onCheckedChange = vi.fn();
    const host = mount(() => createComponent(Checkbox, { onCheckedChange }));
    const el = host.querySelector('lab-checkbox');
    expect(el).toBeTruthy();
    el?.dispatchEvent(new CustomEvent('checked-change', { detail: { checked: true } }));
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
  });
});
