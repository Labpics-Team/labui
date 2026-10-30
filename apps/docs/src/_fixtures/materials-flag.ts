/*
 * Materials-flag demo interactivity — the whole proof of the slice.
 *
 * Two behaviours: (1) flip `data-material` / `data-theme` on the document root
 * — one attribute re-skins every `.lab-material` surface below; (2) open/close
 * the modal so its material surface can be measured in both modes.
 *
 * Values are a CLOSED set, validated before writing to the DOM (never trust a
 * value onto an attribute unchecked — craft-frontend P11).
 */

import { mountMaterialRuntime } from '@labpics/ui-materials';

// Отдельный маршрут проверки CSS вместе с публичным runtime; обычный стенд
// сохраняет CSS-only поведение и проверяет браузерные fallback-рецепты.
if (new URLSearchParams(location.search).has('runtime')) {
  const dispose = mountMaterialRuntime();
  window.addEventListener('pagehide', dispose, { once: true });
}

const root = document.documentElement;

const CONTROLS = {
  'data-material': ['solid', 'glass', 'acrylic'],
  'data-theme': ['dark', 'light'],
} as const;

function bindSelect(testId: string, attr: keyof typeof CONTROLS): void {
  const select = document.querySelector<HTMLSelectElement>(`[data-testid="${testId}"]`);
  if (!select) {
    return;
  }
  const current = root.getAttribute(attr);
  if (current) {
    select.value = current;
  }
  const allowed = new Set<string>(CONTROLS[attr]);
  select.addEventListener('change', () => {
    if (allowed.has(select.value)) {
      root.setAttribute(attr, select.value);
    }
  });
}

bindSelect('mode-select', 'data-material');
bindSelect('theme-select', 'data-theme');

const overlay = document.querySelector<HTMLElement>('[data-testid="modal-overlay"]');
const openBtn = document.querySelector<HTMLElement>('[data-testid="open-modal"]');
const closeBtn = document.querySelector<HTMLElement>('[data-testid="close-modal"]');

function setModal(open: boolean): void {
  overlay?.setAttribute('data-open', open ? 'true' : 'false');
}

openBtn?.addEventListener('click', () => setModal(true));
closeBtn?.addEventListener('click', () => setModal(false));
overlay?.addEventListener('click', (event) => {
  if (event.target === overlay) {
    setModal(false);
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    setModal(false);
  }
});
