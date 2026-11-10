/*
 * Общая инициализация темы parity-демо подключает Colors runtime и связывает
 * [data-testid="theme-select"] с [data-theme] корня. Оба рендерера получают
 * одну тему; её смена не требует изменения самих компонентов.
 */
import { bootColors } from './colors-runtime.js';

const THEMES = ['dark', 'light'] as const;
type Theme = (typeof THEMES)[number];

function isTheme(value: string): value is Theme {
  return (THEMES as readonly string[]).includes(value);
}

export function wireThemeSwitch(): void {
  bootColors();
  wireAuthoredThemeSwitch();
}

/** Только управление темой: palette остаётся у stylesheet-владельца fixture. */
export function wireAuthoredThemeSwitch(): void {
  const root = document.documentElement;
  const select = document.querySelector<HTMLSelectElement>('[data-testid="theme-select"]');
  if (!select) return;
  const current = root.getAttribute('data-theme');
  if (current) select.value = current;
  select.addEventListener('change', () => {
    if (isTheme(select.value)) root.setAttribute('data-theme', select.value);
  });
}
