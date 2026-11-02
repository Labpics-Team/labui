/**
 * Клиентский маунт-смоук (happy-dom, задаётся vitest.config): обёртка монтирует реальный
 * <lab-*>, пробрасывает пропы атрибутами/свойствами, слоты и кастом-события. 3
 * репрезентативных компонента: button (слоты + булевы), input (свойство value),
 * checkbox (кастом-событие).
 */
import { createComponent, createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '../src/generated/button.js';
import { Checkbox } from '../src/generated/checkbox.js';
import { Input } from '../src/generated/input.js';
import { Switch } from '../src/generated/switch.js';

type CheckedElement = HTMLElement & {
  checked: boolean;
  indeterminate?: boolean;
  updateComplete: Promise<boolean>;
};

async function expectState(element: Element | null, checked: boolean, mixed = false) {
  const el = element as CheckedElement;
  await el.updateComplete;
  const input = el.shadowRoot?.querySelector('input');
  expect({
    checked: el.checked,
    mixed: el.indeterminate ?? false,
    native: input?.checked,
    nativeMixed: input?.indeterminate,
  }).toEqual({ checked, mixed, native: checked, nativeMixed: mixed });
}

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
  it('boolean: пропущенный checked использует default, явный false сохраняется', async () => {
    const first = mount(() => createComponent(Switch, { defaultChecked: true }));
    const second = mount(() => createComponent(Switch, { checked: false, defaultChecked: true }));
    await expectState(first.querySelector('lab-switch'), true);
    await expectState(second.querySelector('lab-switch'), false);
  });

  it('boolean: пропущенный mixed использует default, явный false сохраняется', async () => {
    const first = mount(() => createComponent(Checkbox, { defaultIndeterminate: true }));
    const second = mount(() =>
      createComponent(Checkbox, { indeterminate: false, defaultIndeterminate: true }),
    );
    await expectState(first.querySelector('lab-checkbox'), false, true);
    await expectState(second.querySelector('lab-checkbox'), false);
  });

  it('boolean: undefined и посторонний render сохраняют текущее пользовательское состояние', async () => {
    const [checked, setChecked] = createSignal<boolean | undefined>(false);
    const [size, setSize] = createSignal<'s' | 'm' | 'l'>('m');
    const events: boolean[] = [];
    const host = mount(() =>
      createComponent(Switch, {
        get checked() {
          return checked();
        },
        defaultChecked: true,
        get size() {
          return size();
        },
        onCheckedChange: (event: CustomEvent<{ checked: boolean }>) =>
          events.push(event.detail.checked),
      }),
    );
    const el = host.querySelector('lab-switch') as CheckedElement;
    await expectState(el, false);
    setChecked(true);
    await expectState(el, true);
    setChecked(undefined);
    await expectState(el, true);
    el.shadowRoot?.querySelector('input')?.click();
    await expectState(el, false);
    setSize('s');
    await expectState(el, false);
    el.shadowRoot?.querySelector('input')?.click();
    await expectState(el, true);
    setSize('l');
    await expectState(el, true);
    expect(events).toEqual([false, true]);
  });

  it('button: строковые оси → атрибуты, false-булев снят, слот в light DOM', async () => {
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
    const button = el as HTMLElement & { loading: boolean; updateComplete: Promise<boolean> };
    expect(button.loading).toBe(true);
    await button.updateComplete;
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
