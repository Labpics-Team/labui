import type { LabChip } from '@labpics/ui-core/chip';
/**
 * Клиентский маунт-смоук (happy-dom): обёртки монтируют реальные <lab-*>, пробрасывают
 * пропы атрибутами/свойствами, слот-контент и кастом-события. Фикстура Harness.svelte
 * использует button (слот + булевы), input (свойство value), checkbox (кастом-событие)
 * как настоящий потребитель. flushSync форсит $effect-проброс до проверок.
 */
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ChipHarness from './fixtures/ChipHarness.svelte';
import Harness from './fixtures/Harness.svelte';

let host: HTMLElement;
let instance: ReturnType<typeof mount> | undefined;

afterEach(() => {
  if (instance) unmount(instance);
  instance = undefined;
  document.body.innerHTML = '';
});

describe('Svelte mount (проброс на <lab-*>)', () => {
  it('withdrawing defaulted Chip attributes restores its defaults and preserves explicit empty values', async () => {
    host = document.createElement('div');
    document.body.append(host);
    const component = mount(ChipHarness, { target: host, props: {} });
    instance = component;
    component.variant('s', 'action', '');
    flushSync();
    const chip = host.querySelector('lab-chip') as LabChip;
    await chip.updateComplete;
    expect([chip.size, chip.mode, chip.value]).toEqual(['s', 'action', '']);
    component.variant(undefined, undefined, '');
    flushSync();
    await chip.updateComplete;
    expect([chip.size, chip.mode, chip.value, chip.selected]).toEqual(['m', 'filter', '', true]);
    expect(chip.shadowRoot?.querySelector('button')?.getAttribute('aria-pressed')).toBe('true');
    component.variant(undefined, undefined, undefined);
    flushSync();
    await chip.updateComplete;
    expect(chip.value).toBe('on');
  });
  it('reactive updates retain omitted defaults and selection; withdrawn inputs are removed once', async () => {
    host = document.createElement('div');
    document.body.append(host);
    const changed = vi.fn();
    const component = mount(ChipHarness, { target: host, props: { onSelectedChange: changed } });
    instance = component;
    flushSync();
    const chip = host.querySelector('lab-chip') as LabChip;
    await chip.updateComplete;
    expect([chip.mode, chip.size, chip.value, chip.selected]).toEqual(['filter', 'm', 'on', true]);
    component.setPending(true);
    flushSync();
    await chip.updateComplete;
    expect([chip.mode, chip.size, chip.value, chip.selected]).toEqual(['filter', 'm', 'on', true]);
    component.setPending(false);
    flushSync();
    await chip.updateComplete;
    chip.click();
    await chip.updateComplete;
    expect(chip.selected).toBe(false);
    expect(changed).toHaveBeenCalledTimes(1);
    component.withdraw();
    flushSync();
    await chip.updateComplete;
    expect(chip.hasAttribute('name')).toBe(false);
    expect(chip.active).toBe(false);
    chip.name = 'element state';
    chip.active = true;
    await chip.updateComplete;
    component.setPending(true);
    flushSync();
    await chip.updateComplete;
    expect(chip.name).toBe('element state');
    expect(chip.active).toBe(true);
    expect(chip.selected).toBe(false);
  });
  it('button: строковые оси → атрибуты, false-булев снят, слот в light DOM', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    instance = mount(Harness, { target: host, props: {} });
    flushSync();
    const el = host.querySelector('lab-button');
    await el?.updateComplete;
    expect(el).toBeTruthy();
    expect(el?.getAttribute('type')).toBe('accent');
    expect(el?.getAttribute('size')).toBe('l');
    expect(el?.hasAttribute('disabled')).toBe(false);
    expect(el?.hasAttribute('loading')).toBe(true);
    expect(el?.textContent).toContain('Сохранить');
  });

  it('explicit false overrides a true default and subsequent boolean updates reach the render', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    const component = mount(Harness, { target: host, props: {} });
    instance = component;
    flushSync();
    const [el, defaultEl] = host.querySelectorAll('lab-tooltip');
    await el?.updateComplete;
    await defaultEl?.updateComplete;
    expect(el?.arrow).toBe(false);
    expect(defaultEl?.arrow).toBe(true);
    expect(el?.shadowRoot?.querySelector('[part="arrow"]')).toBeNull();
    component.setArrow(true);
    flushSync();
    await el?.updateComplete;
    expect(el?.shadowRoot?.querySelector('[part="arrow"]')).not.toBeNull();
    component.setArrow(false);
    flushSync();
    await el?.updateComplete;
    expect(el?.shadowRoot?.querySelector('[part="arrow"]')).toBeNull();
  });

  it('input: label/value доходят как атрибуты', () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    instance = mount(Harness, { target: host, props: {} });
    flushSync();
    const el = host.querySelector('lab-input');
    expect(el?.getAttribute('label')).toBe('Имя');
    expect(el?.getAttribute('value')).toBe('Даниил');
  });

  it('checkbox: кастом-событие checked-change доходит до обработчика', () => {
    const onCheckedChange = vi.fn();
    host = document.createElement('div');
    document.body.appendChild(host);
    instance = mount(Harness, { target: host, props: { onCheckedChange } });
    flushSync();
    const el = host.querySelector('lab-checkbox');
    expect(el).toBeTruthy();
    el?.dispatchEvent(new CustomEvent('checked-change', { detail: { checked: true } }));
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
  });
});
