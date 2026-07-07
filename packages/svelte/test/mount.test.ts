/**
 * Клиентский маунт-смоук (happy-dom): обёртки монтируют реальные <lab-*>, пробрасывают
 * пропы атрибутами/свойствами, слот-контент и кастом-события. Фикстура Harness.svelte
 * использует button (слот + булевы), input (свойство value), checkbox (кастом-событие)
 * как настоящий потребитель. flushSync форсит $effect-проброс до проверок.
 */
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Harness from './fixtures/Harness.svelte';

let host: HTMLElement;
let instance: ReturnType<typeof mount> | undefined;

afterEach(() => {
  if (instance) unmount(instance);
  instance = undefined;
  document.body.innerHTML = '';
});

describe('Svelte mount (проброс на <lab-*>)', () => {
  it('button: строковые оси → атрибуты, false-булев снят, слот в light DOM', () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    instance = mount(Harness, { target: host, props: {} });
    flushSync();
    const el = host.querySelector('lab-button');
    expect(el).toBeTruthy();
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
