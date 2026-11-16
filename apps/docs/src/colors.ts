import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
import {
  type Theme,
  type ThemeScope,
  createThemeScope,
  initializeColors,
} from '@labui/colors/runtime';

const sample = document.querySelector<HTMLElement>('#theme-sample');
const themeChoice = document.querySelector<HTMLSelectElement>('#theme-choice');
const contrastChoice = document.querySelector<HTMLInputElement>('#contrast-choice');
const status = document.querySelector<HTMLElement>('#theme-status');

if (sample && themeChoice && contrastChoice && status) {
  let scope: ThemeScope | undefined;
  // The hook above must execute before LitElement is evaluated. A dynamic
  // component import keeps that ordering after Vite splits the shared chunks.
  const ready = Promise.all([import('@labpics/ui-core/button'), initializeColors()]).then(() => {
    scope = createThemeScope(sample);
    update();
  });
  function update() {
    if (!scope || !themeChoice || !contrastChoice || !status) return;
    const result = scope.update({
      theme: themeChoice.value as Theme,
      contrast: contrastChoice.checked ? 'more' : 'normal',
    });
    status.textContent = result.ok
      ? 'Тема этой области готова.'
      : 'Тему не удалось изменить. Сохранена предыдущая палитра.';
  }
  themeChoice.addEventListener('change', update);
  contrastChoice.addEventListener('change', update);
  ready.catch(() => {
    status.textContent = 'Доступна начальная палитра. Динамическая тема не загрузилась.';
  });
  window.addEventListener('pagehide', () => scope?.dispose(), { once: true });
}
