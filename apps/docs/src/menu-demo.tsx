import '@labpics/ui-core/menu';
import '@labpics/ui-core/context-menu';
import '@labpics/ui-core/menubar';
import { symbol as checkmark } from '@labpics/icons/symbols/checkmark';
import type { LabMenuItem, LabMenubarItem } from '@labpics/ui-core/menu/runtime';
import { ContextMenu, Menu, Menubar } from '@labpics/ui-react/menu';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { wireThemeSwitch } from './theme-switch.js';

wireThemeSwitch();
const items: readonly LabMenuItem[] = [
  { value: 'edit', label: 'Edit', type: 'accent', icon: checkmark, shortcut: ['⌘', 'E'] },
  { value: 'archive', label: 'Archive', disabled: true, shortcut: ['⌘', 'A'] },
  { value: 'sep', kind: 'separator' },
  { value: 'guides', label: 'Show guides', kind: 'check', closeOnSelect: false },
  { value: 'small', label: 'Small', kind: 'radio', group: 'size', closeOnSelect: false },
  { value: 'large', label: 'Large', kind: 'radio', group: 'size', closeOnSelect: false },
  {
    value: 'share',
    label: 'Share',
    kind: 'submenu',
    items: [
      { value: 'copy-link', label: 'Copy link', shortcut: ['⌘', 'C'] },
      {
        value: 'export',
        label: 'Export',
        kind: 'submenu',
        items: [
          { value: 'pdf', label: 'PDF' },
          { value: 'png', label: 'PNG' },
        ],
      },
    ],
  },
  { value: 'delete', label: 'Delete', type: 'danger', icon: checkmark },
];
const menus: readonly LabMenubarItem[] = [
  { value: 'file', label: 'File', items },
  { value: 'disabled', label: 'Disabled', disabled: true, items: [] },
  {
    value: 'view',
    label: 'View',
    items: [
      { value: 'zoom', label: 'Zoom in' },
      { value: 'fit', label: 'Fit page' },
    ],
  },
];
declare global {
  interface Window {
    menuUpdate: Record<
      string,
      (
        change:
          | 'reorder'
          | 'disable'
          | 'disable-submenu'
          | 'rtl'
          | 'controlled-open'
          | 'remove-submenu',
      ) => void
    >;
  }
}
window.menuUpdate = {};
const litRoot = document.querySelector('#lit-root');
const eventLog = document.querySelector('#event-log');
const reactRoot = document.querySelector('#react-root');
if (!litRoot || !eventLog || !reactRoot) throw new Error('Menu fixture mount points are missing');
const record = (renderer: string, kind: string, value: unknown) => {
  eventLog.textContent += `${JSON.stringify({ renderer, kind, value })}\n`;
};
for (const [suffix, tag] of [
  ['menu', 'lab-menu'],
  ['context', 'lab-context-menu'],
  ['menubar', 'lab-menubar'],
  ['disabled', 'lab-menu'],
  ['controlled', 'lab-menu'],
] as const) {
  const element = document.createElement(tag);
  element.dataset.testid = `lit-${suffix}`;
  element.label = suffix === 'context' ? 'Context actions' : 'Actions';
  if ('items' in element) {
    element.items = items;
    element.heading = suffix === 'menu' ? 'Document' : '';
  }
  if ('menus' in element) element.menus = menus;
  element.defaultCheckedValues = ['small'];
  if (suffix === 'disabled') element.disabled = true;
  if (suffix === 'controlled' && 'open' in element) {
    element.open = false;
    element.checkedValues = [];
  }
  if (suffix === 'context') {
    const region = document.createElement('div');
    region.className = 'context-target';
    region.textContent = 'Right click or press Shift+F10';
    element.append(region);
  }
  for (const event of ['select', 'open-change', 'checked-values-change', 'value-change'])
    element.addEventListener(event, (e) => record('lit', event, (e as CustomEvent).detail));
  litRoot.append(element);
  window.menuUpdate[`lit-${suffix}`] = (change) => {
    if (change === 'reorder' && 'items' in element)
      element.items = [...items]
        .reverse()
        .map((item) => (item.value === 'edit' ? { ...item, label: 'Rename' } : item));
    if (change === 'disable' && 'items' in element)
      element.items = items.map((item) =>
        item.value === 'edit' ? { ...item, disabled: true } : item,
      );
    if (change === 'disable-submenu' && 'items' in element)
      element.items = items.map((item) =>
        item.value === 'share' ? { ...item, disabled: true } : item,
      );
    if (change === 'rtl') element.dir = 'rtl';
    if (change === 'controlled-open' && 'open' in element) element.open = true;
    if (change === 'remove-submenu' && 'items' in element)
      element.items = items.filter((item) => item.kind !== 'submenu');
  };
}
function Examples() {
  const [currentItems, setItems] = useState(items);
  const [dir, setDir] = useState<'ltr' | 'rtl'>('ltr');
  const [controlledOpen, setOpen] = useState(false);
  window.menuUpdate['react-menu'] = (change) => {
    if (change === 'reorder')
      setItems(
        [...items]
          .reverse()
          .map((item) => (item.value === 'edit' ? { ...item, label: 'Rename' } : item)),
      );
    if (change === 'disable')
      setItems(items.map((item) => (item.value === 'edit' ? { ...item, disabled: true } : item)));
    if (change === 'disable-submenu')
      setItems(items.map((item) => (item.value === 'share' ? { ...item, disabled: true } : item)));
    if (change === 'remove-submenu') setItems(items.filter((item) => item.kind !== 'submenu'));
  };
  window.menuUpdate['react-menubar'] = (change) => {
    if (change === 'rtl') setDir('rtl');
  };
  window.menuUpdate['react-controlled'] = (change) => {
    if (change === 'controlled-open') setOpen(true);
  };
  const events = {
    onSelect: (value: string) => record('react', 'select', { value }),
    onCheckedValuesChange: (values: readonly string[]) =>
      record('react', 'checked-values-change', { values }),
  };
  return (
    <>
      <div data-testid="react-menu">
        <Menu
          {...events}
          items={currentItems}
          label="Actions"
          heading="Document"
          defaultCheckedValues={['small']}
        />
      </div>
      <div data-testid="react-context">
        <ContextMenu {...events} items={items} label="Context actions">
          <div className="context-target">Right click or press Shift+F10</div>
        </ContextMenu>
      </div>
      <div data-testid="react-menubar">
        <Menubar {...events} menus={menus} dir={dir} />
      </div>
      <div data-testid="react-disabled">
        <Menu items={items} label="Actions" disabled />
      </div>
      <div data-testid="react-controlled">
        <Menu {...events} items={items} label="Actions" open={controlledOpen} checkedValues={[]} />
      </div>
    </>
  );
}
createRoot(reactRoot).render(
  <StrictMode>
    <Examples />
  </StrictMode>,
);
