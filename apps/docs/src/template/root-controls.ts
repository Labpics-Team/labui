/*
 * Root controls — the Theme + Material switchers shared by every docs page.
 *
 * Both write a single attribute on the document root (`data-theme`,
 * `data-material`). That one flip re-skins every documented element below with
 * zero element edits — which is exactly the theme/material agnosticism the page
 * is meant to demonstrate. The component never observes these attributes; it
 * reads only the `--lab-*` roles the colours/material layers rebind under them.
 *
 * Values are a closed set, validated before being written to the DOM — never
 * trust a value onto the root unchecked, even from our own <option>s
 * (craft-frontend P11).
 */
import { el } from './dom.js';

/** Closed option sets — the single source of truth for the union + guard. */
const CONTROLS = {
  'data-theme': [
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
  ],
  // Канон оси материала — packages/materials/src/materials/*.css (файл на
  // материал, порядок = order.ts; ADR-0008/0009):
  // `data-material="solid|glass|acrylic"` (ambient/glassy ушли с core-шимами
  // в #41; отдельный blur снесён как перцептивный дубль acrylic).
  'data-material': [
    { value: 'solid', label: 'Solid' },
    { value: 'glass', label: 'Glass' },
    { value: 'acrylic', label: 'Acrylic' },
  ],
} as const;

/** Render both switchers as a labelled toolbar and wire them to the root. */
export function renderRootControls(): HTMLElement {
  return el('div', { class: 'root-controls', role: 'group', 'aria-label': 'Theme and material' }, [
    buildSwitch('Theme', 'data-theme'),
    buildSwitch('Material', 'data-material'),
  ]);
}

function buildSwitch(label: string, attr: keyof typeof CONTROLS): HTMLElement {
  const root = document.documentElement;
  const options = CONTROLS[attr];
  const allowed = new Set<string>(options.map((o) => o.value));
  const id = `ctl-${attr}`;

  const select = el(
    'select',
    { id, 'data-testid': `${attr}-select` },
    options.map((o) => el('option', { value: o.value }, [o.label])),
  );

  // Reflect the current root state so a reload keeps the chosen value.
  const current = root.getAttribute(attr);
  if (current && allowed.has(current)) select.value = current;
  else root.setAttribute(attr, options[0].value); // honest default, set explicitly

  select.addEventListener('change', () => {
    if (allowed.has(select.value)) root.setAttribute(attr, select.value);
  });

  return el('label', { for: id, class: 'root-control' }, [`${label} `, select]);
}
