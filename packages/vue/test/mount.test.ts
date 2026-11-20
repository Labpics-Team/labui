/**
 * Клиентский маунт-смоук (happy-dom, задаётся vitest.config): обёртка монтирует реальный
 * <lab-*>, пробрасывает пропы атрибутами/свойствами, слоты и кастом-события. 3
 * репрезентативных компонента: button (слоты + булевы), input (свойство value),
 * checkbox (кастом-событие).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import { Button } from '../src/generated/button.js';
import { Checkbox } from '../src/generated/checkbox.js';
import { Input } from '../src/generated/input.js';
import { Tooltip } from '../src/generated/tooltip.js';

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
  it('button: строковые оси → атрибуты, false-булев снят, слот в light DOM', async () => {
    const { host } = mount(
      h(Button, { type: 'accent', size: 'l', disabled: false, loading: true }, () => 'Сохранить'),
    );
    const el = host.querySelector('lab-button');
    await el?.updateComplete;
    expect(el).toBeTruthy();
    expect(el?.getAttribute('type')).toBe('accent');
    expect(el?.getAttribute('size')).toBe('l');
    // disabled=false → атрибут снят (иначе Lit прочитал бы присутствие как true).
    expect(el?.hasAttribute('disabled')).toBe(false);
    // loading=true → атрибут-флаг присутствует.
    expect(el?.hasAttribute('loading')).toBe(true);
    expect(el?.textContent).toContain('Сохранить');
  });

  it('explicit false overrides a true default and subsequent boolean updates reach the render', async () => {
    const arrow = ref(false);
    const { host } = mount(
      h({ render: () => h(Tooltip, { arrow: arrow.value, content: 'Help' }, () => 'Trigger') }),
    );
    const el = host.querySelector('lab-tooltip');
    await el?.updateComplete;
    expect(el?.arrow).toBe(false);
    expect(el?.shadowRoot?.querySelector('[part="arrow"]:not([hidden])')).toBeNull();
    arrow.value = true;
    await nextTick();
    await el?.updateComplete;
    expect(el?.shadowRoot?.querySelector('[part="arrow"]:not([hidden])')).not.toBeNull();
    arrow.value = false;
    await nextTick();
    await el?.updateComplete;
    expect(el?.shadowRoot?.querySelector('[part="arrow"]:not([hidden])')).toBeNull();
    const omitted = mount(h(Tooltip, { content: 'Default' }, () => 'Trigger'));
    const defaultEl = omitted.host.querySelector('lab-tooltip');
    await defaultEl?.updateComplete;
    expect(defaultEl?.arrow).toBe(true);
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
