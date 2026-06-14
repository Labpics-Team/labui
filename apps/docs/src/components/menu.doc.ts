/*
 * `lab-menu` documentation config — the second compound + positioned canon: a
 * trigger that opens a positioned menu of ACTIONS. It shares Select's machinery but
 * differs in semantics (role="menu"/menuitem, no selected value, no form field):
 * choosing an item RUNS it and closes the menu.
 *
 * The matrix and live example render REAL `<lab-menu>` elements. The menu is hidden
 * until the machine opens it on click, so the grid shows the live TRIGGERS across
 * size and placement; clicking any cell genuinely opens the menu, navigates with
 * Arrow/Home/End + typeahead, runs an item on Enter/click, and dismisses on Escape /
 * outside-click — all from the @zag-js/menu machine, nothing faked.
 */
import '@labpics/ui-core/menu';
import type { LabMenuItem } from '@labpics/ui-core/menu';
import type { ComponentDoc } from '../template/component-doc.js';

/** The shared action set for every documented specimen. */
const ACTIONS: readonly LabMenuItem[] = [
  { value: 'edit', label: 'Edit' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'archive', label: 'Archive', disabled: true },
  { value: 'sep-1', label: '', separator: true },
  { value: 'delete', label: 'Delete', danger: true },
];

/** Build a real `<lab-menu>` with the given attribute map applied. The items ride
 * the JSON `items` attribute; a `label` names the trigger button. */
function makeMenu(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const el = document.createElement('lab-menu');
  el.setAttribute('items', JSON.stringify(ACTIONS));
  el.setAttribute('label', 'Actions');
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false) continue;
    if (value === true) {
      el.setAttribute(key, '');
    } else {
      el.setAttribute(key, String(value));
    }
  }
  return el;
}

export const menuDoc: ComponentDoc = {
  slug: 'menu',
  order: 12,
  tag: 'lab-menu',
  title: 'Menu',
  summary:
    'A trigger that opens a positioned menu of actions. Runs the @zag-js/menu machine through the LabUI seam: the machine owns open-on-click, Arrow/Home/End navigation + typeahead, Escape / outside-click dismiss, focus restoration, role="menu"/menuitem + aria-activedescendant, and dynamic positioning (Floating UI). Choosing an item emits its value and closes the menu. The element only paints with semantic --lab-* roles.',
  status: { kind: 'stable' },

  statesMatrix: {
    axes: [
      {
        name: 'Size',
        attribute: 'size',
        options: [
          { label: 'S', value: 's' },
          { label: 'M', value: 'm' },
          { label: 'L', value: 'l' },
        ],
      },
      {
        name: 'Placement',
        attribute: 'placement',
        options: [
          { label: 'Bottom start', value: 'bottom-start' },
          { label: 'Bottom end', value: 'bottom-end' },
        ],
      },
    ],
    make: makeMenu,
  },

  anatomy: [
    {
      index: 1,
      name: 'Trigger',
      description:
        'The Zag trigger — a real <button>. The machine spreads aria-haspopup="menu", aria-controls → content id, aria-expanded and the toggle handler; the caret rotates when open (data-state="open").',
    },
    {
      index: 2,
      name: 'Positioner',
      description:
        'The Zag positioner. Floating UI writes --x / --y here (position:fixed, escaping clipping/stacking ancestors without a portal in the Lit element) and mirrors the content z-index into --z-index.',
    },
    {
      index: 3,
      name: 'Content (menu)',
      description:
        'The floating menu — role="menu", hidden until open, aria-activedescendant → the highlighted item id. The raised surface (--lab-surface-raised) with a --lab-border-soft hairline, --lab-fx-shadow-major lift, layered at --lab-z-dropdown.',
    },
    {
      index: 4,
      name: 'Item',
      description:
        'One action — role="menuitem", keyed by data-value. The machine sets data-highlighted on the navigated item; a danger item paints its label --lab-label-danger. Choosing it emits select and closes the menu.',
    },
    {
      index: 5,
      name: 'Separator',
      description:
        'A non-interactive divider (role="separator") between groups of items — a --lab-border-soft hairline. It carries no machine behaviour and is skipped by keyboard navigation.',
    },
  ],

  meaning: {
    purpose:
      'A menu is a list of ACTIONS a user can run on a thing — Edit, Duplicate, Delete — opened from a trigger on click. It navigates by keyboard (Arrow/Home/End and typeahead), runs an item on Enter or click (and closes), and dismisses on Escape or outside-click with focus returning to the trigger. It is NOT a select (which picks and holds a value — use Select, semantically role=listbox) and NOT a set of buttons (use a toolbar when the actions should always be visible).',
    dos: [
      'Use for a set of actions tied to a trigger (a row’s "⋯" menu, a toolbar overflow).',
      'Let the machine own navigation, typeahead and dismiss — never re-implement them.',
      'Mark a destructive action danger so it reads as --lab-label-danger.',
      'Group related actions with a separator entry.',
    ],
    donts: [
      "Don't use it to pick a value to keep — that is a Select (role=listbox, aria-selected).",
      "Don't hand-roll a positioned div with a keydown handler; the machine owns positioning, roving and aria-activedescendant.",
      "Don't key items by index — items can be filtered/reordered; the machine and the element key by value.",
      "Don't fill it with non-actions (headings, paragraphs); a menu is a list of commands.",
    ],
  },

  liveExample: {
    make: () => makeMenu({ size: 'm' }),
    // Honest live controls: size and placement are reflected attributes the machine
    // reads. Clicking the trigger runs the Zag machine (open/navigate/run/dismiss).
    controls: [
      {
        kind: 'select',
        label: 'Size',
        attribute: 'size',
        options: [
          { label: 'S', value: 's' },
          { label: 'M', value: 'm' },
          { label: 'L', value: 'l' },
        ],
      },
      {
        kind: 'select',
        label: 'Placement',
        attribute: 'placement',
        options: [
          { label: 'Bottom start', value: 'bottom-start' },
          { label: 'Bottom end', value: 'bottom-end' },
          { label: 'Top start', value: 'top-start' },
        ],
      },
      { kind: 'toggle', label: 'Disabled', attribute: 'disabled' },
    ],
  },

  api: {
    props: [
      {
        name: 'items',
        type: 'LabMenuItem[] ({ value, label, disabled?, danger?, separator? })',
        default: '[]',
        description:
          'The items. A JS property; a JSON string attribute is parsed for HTML/SSR. Each item’s value is its key; a separator entry is a non-interactive divider.',
      },
      {
        name: 'size',
        type: "'s' | 'm' | 'l'",
        default: "'m'",
        description: 'Control size — drives menu font band and item padding.',
      },
      {
        name: 'placement',
        type: "Placement ('bottom-start' | 'bottom-end' | 'top-start' | …)",
        default: "'bottom-start'",
        description: 'Where the menu sits relative to the trigger (Zag popper).',
      },
      {
        name: 'disabled',
        type: 'boolean',
        default: 'false',
        description: 'Trigger non-interactive when present. An item may also be disabled.',
      },
      {
        name: 'label',
        type: 'string',
        default: "'Menu'",
        description: 'Label shown in the trigger button.',
      },
    ],
    events: [
      {
        name: 'select',
        description:
          'CustomEvent<SelectionDetails> fired with the chosen item’s value when an item is run. The machine is the source of truth.',
      },
      {
        name: 'open-change',
        description:
          'CustomEvent<OpenChangeDetails> fired when the machine opens or closes the menu.',
      },
    ],
    slots: [],
  },
};
