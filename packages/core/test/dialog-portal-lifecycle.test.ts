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

  const firstPortal = document.querySelector('[data-portal-for="reconnected-dialog"]');
  expect(firstPortal?.shadowRoot?.querySelector('.body')?.firstElementChild).toBe(body);

  dialog.remove();
  expect(document.querySelector('[data-portal-for="reconnected-dialog"]')).toBeNull();
  expect([...dialog.childNodes]).toEqual([before, body, after]);
  expect(input.value).toBe('несохранённый ввод');

  document.body.append(dialog);
  await dialog.updateComplete;
  const secondPortal = document.querySelector('[data-portal-for="reconnected-dialog"]');
  expect(secondPortal).not.toBe(firstPortal);
  expect(secondPortal?.shadowRoot?.querySelector('.body')?.firstElementChild).toBe(body);
  expect(input.value).toBe('несохранённый ввод');
});
