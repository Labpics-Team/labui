/**
 * Клиентский маунт-смоук (happy-dom): обёртки монтируют реальные <lab-*>, пробрасывают
 * пропы атрибутами/свойствами, слот-контент и кастом-события. Фикстура Harness.svelte
 * использует button (слот + булевы), input (свойство value), checkbox (кастом-событие)
 * как настоящий потребитель. flushSync форсит $effect-проброс до проверок.
 */
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Harness from './fixtures/Harness.svelte';
import BooleanHarness from './fixtures/BooleanHarness.svelte';

type CheckedElement = HTMLElement & {
  checked: boolean;
  indeterminate?: boolean;
  updateComplete: Promise<boolean>;
};

async function expectState(element: Element | null, checked: boolean, mixed = false, flush = true) {
  if (flush) flushSync();
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

let host: HTMLElement;
let instance: ReturnType<typeof mount> | undefined;

afterEach(() => {
  if (instance) unmount(instance);
  instance = undefined;
  document.body.innerHTML = '';
});

describe('Svelte mount (проброс на <lab-*>)', () => {
  it('boolean: пропущенный checked использует default, явный false сохраняется', async () => {
    host = document.createElement('div');
    document.body.append(host);
    instance = mount(BooleanHarness, { target: host, props: { checked: false } });
    await expectState(host.querySelector('lab-switch[data-case="omitted"]'), true, false, false);
    await expectState(host.querySelector('lab-switch[data-case="supplied"]'), false, false, false);
  });

  it('boolean: пропущенный mixed использует default, явный false сохраняется', async () => {
    host = document.createElement('div');
    document.body.append(host);
    instance = mount(BooleanHarness, { target: host, props: { indeterminate: false } });
    await expectState(host.querySelector('lab-checkbox[data-case="omitted"]'), false, true, false);
    await expectState(
      host.querySelector('lab-checkbox[data-case="supplied"]'),
      false,
      false,
      false,
    );
  });

  it('boolean: undefined и посторонний render сохраняют текущее пользовательское состояние', async () => {
    host = document.createElement('div');
    document.body.append(host);
    const events: boolean[] = [];
    const control = mount(BooleanHarness, {
      target: host,
      props: { checked: false, onCheckedChange: (event) => events.push(event.detail.checked) },
    });
    instance = control;
    flushSync();
    const el = host.querySelector('lab-switch[data-case="supplied"]') as CheckedElement;
    await expectState(el, false);
    control.setChecked(true);
    await expectState(el, true);
    control.setChecked(undefined);
    await expectState(el, true);
    el.shadowRoot?.querySelector('input')?.click();
    await expectState(el, false);
    control.setSize('s');
    await expectState(el, false);
    el.shadowRoot?.querySelector('input')?.click();
    await expectState(el, true);
    control.setSize('l');
    await expectState(el, true);
    expect(events).toEqual([false, true]);
  });

  it('button: строковые оси → атрибуты, false-булев снят, слот в light DOM', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    instance = mount(Harness, { target: host, props: {} });
    flushSync();
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
