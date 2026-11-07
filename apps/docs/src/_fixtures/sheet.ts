import type { LabSheet } from '@labpics/ui-core/sheet';

const sheet = document.getElementById('sheet') as LabSheet;
const empty = document.getElementById('empty') as LabSheet;
const form = document.querySelector<HTMLFormElement>('form');
const count = document.getElementById('background-count');
let backgroundClicks = 0;
document.getElementById('background')?.addEventListener('click', () => {
  backgroundClicks++;
  if (count) count.textContent = String(backgroundClicks);
});
form?.addEventListener('submit', (event) => {
  event.preventDefault();
  sheet.open = false;
});
const parameters = new URLSearchParams(location.search);
document.documentElement.setAttribute('data-theme', parameters.get('theme') ?? 'light');
document.documentElement.setAttribute('data-material', parameters.get('material') ?? 'solid');
document.documentElement.setAttribute('data-contrast', parameters.get('contrast') ?? 'normal');

// Обработчики формы устанавливаются до upgrade, как у потребителя статического HTML.
async function mount(): Promise<void> {
  await import('@labpics/ui-core/sheet');
  await Promise.all([sheet.updateComplete, empty.updateComplete]);
  document.documentElement.setAttribute('data-sheet-fixture-ready', 'true');
}

void mount();
