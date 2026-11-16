import '@labpics/ui-core/button';
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
  const ready = initializeColors().then(() => {
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
      ? 'Тема этой области обновлена.'
      : 'Тему не удалось изменить. Сохранена предыдущая палитра.';
  }
  themeChoice.addEventListener('change', update);
  contrastChoice.addEventListener('change', update);
  ready.catch(() => {
    status.textContent = 'Доступна начальная палитра. Динамическая тема не загрузилась.';
  });
  window.addEventListener('pagehide', () => scope?.dispose(), { once: true });
}
