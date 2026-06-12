import type { LabButtonKind, LabButtonSize, LabButtonType } from '../src/index.js';
// Registers the <lab-button> custom element via its @customElement decorator.
import '../src/index.js';

/**
 * Builds the structural axis matrix (not all 432 renders):
 *   type × kind at size m, plus a size row, an icon button, and the
 *   loading/disabled states. hover/pressed/focus are exercised by Playwright
 *   via real interaction, so they aren't separate cells.
 */
const types: LabButtonType[] = ['accent', 'neutral', 'danger'];
const kinds: LabButtonKind[] = ['fill', 'tinted', 'border', 'ghost'];
const sizes: LabButtonSize[] = ['s', 'm', 'l'];

function cell(caption: string): HTMLDivElement {
  const div = document.createElement('div');
  div.className = 'cell';
  const cap = document.createElement('span');
  cap.className = 'caption';
  cap.textContent = caption;
  div.appendChild(cap);
  return div;
}

function button(props: {
  type: LabButtonType;
  kind: LabButtonKind;
  size?: LabButtonSize;
  icon?: boolean;
  loading?: boolean;
  disabled?: boolean;
  testid: string;
  label?: string;
}): HTMLElement {
  const el = document.createElement('lab-button');
  el.setAttribute('type', props.type);
  el.setAttribute('kind', props.kind);
  if (props.size) el.setAttribute('size', props.size);
  if (props.icon) el.setAttribute('icon', '');
  if (props.loading) el.setAttribute('loading', '');
  if (props.disabled) el.setAttribute('disabled', '');
  el.setAttribute('data-testid', props.testid);
  if (props.icon) {
    const icon = document.createElement('span');
    icon.slot = 'icon';
    icon.textContent = '★';
    el.appendChild(icon);
  } else {
    el.textContent = props.label ?? `${props.type}/${props.kind}`;
  }
  return el;
}

const matrix = document.getElementById('matrix');
if (!matrix) throw new Error('matrix mount point missing');

// type × kind (size m)
for (const type of types) {
  for (const kind of kinds) {
    const c = cell(`${type} · ${kind}`);
    c.appendChild(button({ type, kind, testid: `btn-${type}-${kind}` }));
    matrix.appendChild(c);
  }
}

// size axis (accent/fill)
{
  const c = cell('size s · m · l');
  for (const size of sizes) {
    c.appendChild(button({ type: 'accent', kind: 'fill', size, testid: `btn-size-${size}`, label: size }));
  }
  matrix.appendChild(c);
}

// icon-only
{
  const c = cell('icon-only');
  c.appendChild(button({ type: 'accent', kind: 'fill', icon: true, testid: 'btn-icon' }));
  matrix.appendChild(c);
}

// loading + disabled
{
  const c = cell('loading · disabled');
  c.appendChild(button({ type: 'accent', kind: 'fill', loading: true, testid: 'btn-loading', label: 'Saving' }));
  c.appendChild(button({ type: 'neutral', kind: 'border', disabled: true, testid: 'btn-disabled', label: 'Off' }));
  matrix.appendChild(c);
}

// Theme toggle — proves theme-agnosticism by swapping the --lab-* set only.
const toggle = document.getElementById('theme-toggle');
const themeName = document.querySelector('[data-testid="theme-name"]');
toggle?.addEventListener('click', () => {
  const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  document.body.dataset.theme = next;
  if (themeName) themeName.textContent = next;
});
