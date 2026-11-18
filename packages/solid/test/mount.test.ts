import type { LabChip } from '@labpics/ui-core/chip';
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
import { Chip } from '../src/generated/chip.js';
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
  it('withdrawing defaulted Chip attributes restores its defaults and preserves explicit empty values', async () => {
    const [size, setSize] = createSignal<LabChip['size'] | undefined>('s');
    const [mode, setMode] = createSignal<LabChip['mode'] | undefined>('action');
    const [value, setValue] = createSignal<string | undefined>('');
    const host = mount(() =>
      createComponent(Chip, {
        defaultSelected: true,
        get size() {
          return size();
        },
        get mode() {
          return mode();
        },
        get value() {
          return value();
        },
        children: 'Filter',
      }),
    );
    const chip = host.querySelector('lab-chip') as LabChip;
    await chip.updateComplete;
    expect([chip.size, chip.mode, chip.value]).toEqual(['s', 'action', '']);
    setSize(undefined);
    setMode(undefined);
    await chip.updateComplete;
    expect([chip.size, chip.mode, chip.value, chip.selected]).toEqual(['m', 'filter', '', true]);
    expect(chip.shadowRoot?.querySelector('button')?.getAttribute('aria-pressed')).toBe('true');
    setValue(undefined);
    await chip.updateComplete;
    expect(chip.value).toBe('on');
  });
  it('reactive updates retain omitted defaults and selection; withdrawn inputs are removed once', async () => {
    const [loading, setLoading] = createSignal(false);
    const [name, setName] = createSignal<string | undefined>('filter');
    const [active, setActive] = createSignal<boolean | undefined>(true);
    const changed = vi.fn();
    const host = mount(() =>
      createComponent(Chip, {
        defaultSelected: true,
        get loading() {
          return loading();
        },
        get name() {
          return name();
        },
        get active() {
          return active();
        },
        onSelectedChange: changed,
        children: 'Solid filter',
      }),
    );
    const chip = host.querySelector('lab-chip') as LabChip;
    await chip.updateComplete;
    expect([chip.mode, chip.size, chip.value, chip.selected]).toEqual(['filter', 'm', 'on', true]);
    setLoading(true);
    await chip.updateComplete;
    expect([chip.mode, chip.size, chip.value, chip.selected]).toEqual(['filter', 'm', 'on', true]);
    setLoading(false);
    await chip.updateComplete;
    chip.click();
    await chip.updateComplete;
    expect(chip.selected).toBe(false);
    expect(changed).toHaveBeenCalledTimes(1);
    setName(undefined);
    setActive(undefined);
    await chip.updateComplete;
    expect(chip.hasAttribute('name')).toBe(false);
    expect(chip.active).toBe(false);
    chip.name = 'element state';
    chip.active = true;
    await chip.updateComplete;
    setLoading(true);
    await chip.updateComplete;
    expect(chip.name).toBe('element state');
    expect(chip.active).toBe(true);
    expect(chip.selected).toBe(false);
  });
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
