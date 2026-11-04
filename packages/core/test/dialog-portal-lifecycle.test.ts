// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import '../src/components/dialog/index.js';

afterEach(() => {
  document.body.replaceChildren();
});

it('отключение и повторное подключение сохраняют содержимое и состояние формы', async () => {
  const dialog = document.createElement('lab-dialog');
  dialog.setAttribute('data-testid', 'reconnected-dialog');
  const before = document.createTextNode('Открыть ');
  const body = document.createElement('div');
  body.slot = 'content';
  const input = document.createElement('input');
  input.value = 'несохранённый ввод';
  body.append(input);
  const after = document.createElement('span');
  after.textContent = 'панель';
  dialog.append(before, body, after);
  document.body.append(dialog);
  await dialog.updateComplete;

  const firstPortal = dialog.shadowRoot?.querySelector('[data-portal-for="reconnected-dialog"]');
  expect(firstPortal?.isConnected).toBe(true);
  expect(firstPortal?.shadowRoot?.querySelector('.body')?.firstElementChild).toBe(body);

  dialog.remove();
  expect(firstPortal?.isConnected).toBe(false);
  expect([...dialog.childNodes]).toEqual([before, body, after]);
  expect(input.value).toBe('несохранённый ввод');

  document.body.append(dialog);
  await dialog.updateComplete;
  const secondPortal = dialog.shadowRoot?.querySelector('[data-portal-for="reconnected-dialog"]');
  expect(secondPortal?.isConnected).toBe(true);
  expect(
    dialog.shadowRoot?.querySelectorAll('[data-portal-for="reconnected-dialog"]'),
  ).toHaveLength(1);
  expect(secondPortal?.shadowRoot?.querySelector('.body')?.firstElementChild).toBe(body);
  expect(input.value).toBe('несохранённый ввод');
});
