/*
 * `lab-select` documentation config — the COMPOUND + POSITIONED canon: a trigger
 * that opens a positioned listbox of selectable options. It fuses the keyed-compound
 * group machine (radio-group) with the positioned, dismissable overlay (popover).
 *
 * The matrix and live example render REAL `<lab-select>` elements. The listbox is
 * hidden until the machine opens it on click, so the grid shows the live TRIGGERS
 * across size and placement; clicking any cell genuinely opens the listbox, navigates
 * with Arrow/Home/End + typeahead, selects on Enter/click, and dismisses on Escape /
 * outside-click — all from the @zag-js/select machine, nothing faked. The live
 * controls re-point the same axes the machine reads.
 */
import '@labpics/ui-core/select';
import type { LabSelectItem } from '@labpics/ui-core/select';
import type { ComponentDoc } from '../template/component-doc.js';

/** The shared option set for every documented specimen. */
const FRUITS: readonly LabSelectItem[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'durian', label: 'Durian', disabled: true },
  { value: 'elderberry', label: 'Elderberry' },
];

/** Build a real `<lab-select>` with the given attribute map applied. The options
 * ride the JSON `items` attribute; a `placeholder` makes the empty trigger legible. */
function makeSelect(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const el = document.createElement('lab-select');
  el.setAttribute('items', JSON.stringify(FRUITS));
  el.setAttribute('placeholder', 'Pick a fruit…');
  el.setAttribute('label', 'Fruit');
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

export const selectDoc: ComponentDoc = {
  slug: 'select',
  order: 11,
  tag: 'lab-select',
  title: 'Select',
  summary:
    'A trigger that opens a positioned listbox of options. Runs the @zag-js/select machine through the LabUI seam: the machine owns open-on-click, single/multiple selection, Arrow/Home/End navigation + typeahead, Escape / outside-click dismiss, focus restoration, role="combobox"/listbox/option + aria-activedescendant/selected/multiselectable, dynamic positioning (Floating UI), and a hidden native <select> for forms. The element only paints with semantic --lab-* roles.',
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
        name: 'Mode',
        attribute: 'multiple',
        options: [
          { label: 'Single', value: false },
          { label: 'Multiple', value: true },
        ],
      },
    ],
    make: makeSelect,
  },

  anatomy: [
    {
      index: 1,
      name: 'Label',
      description:
        'Optional control label — the Zag label part. Its id names the trigger (aria-labelledby) so the combobox has an accessible name.',
    },
    {
      index: 2,
      name: 'Control / Trigger',
      description:
        'The Zag trigger — a real <button> with role="combobox". The machine spreads aria-haspopup="listbox", aria-controls → content id, aria-expanded and the toggle handler. The control is a layout frame around it.',
    },
    {
      index: 3,
      name: 'Value text',
      description:
        'The Zag value-text — shows the selected option label(s), or the placeholder (data-placeholder-shown) when nothing is selected, coloured by --lab-label-tertiary.',
    },
    {
      index: 4,
      name: 'Indicator',
      description:
        'The disclosure caret — the Zag indicator. It rotates when open (the machine sets data-state="open").',
    },
    {
      index: 5,
      name: 'Positioner',
      description:
        'The Zag positioner. Floating UI writes --x / --y here (position:fixed, escaping clipping/stacking ancestors without a portal in the Lit element) and mirrors the content z-index into --z-index.',
    },
    {
      index: 6,
      name: 'Content (listbox)',
      description:
        'The floating listbox — role="listbox", hidden until open, aria-activedescendant → the highlighted option id, aria-multiselectable when multiple. The raised surface (--lab-bg-secondary) with a --lab-border-soft hairline, --lab-fx-shadow-major lift, layered at --lab-z-dropdown.',
    },
    {
      index: 7,
      name: 'Option',
      description:
        'One option — role="option", keyed by data-value. The machine sets aria-selected + data-state="checked" on the chosen option and data-highlighted on the navigated one. The selected label is --lab-label-accent; the highlight fill is --lab-fill-primary.',
    },
    {
      index: 8,
      name: 'Hidden native <select>',
      description:
        'A visually-hidden native <select> the machine mirrors the value into, so the control submits with a plain HTML form (the name attribute is its field name).',
    },
  ],

  meaning: {
    purpose:
      'A select lets a user pick one value (or several, when multiple) from a closed list that is too long or too secondary to show inline as radios. It opens from a trigger on click, places a listbox next to it, navigates by keyboard (Arrow/Home/End and typeahead), and dismisses on Escape or outside-click with focus returning to the trigger. It is NOT a menu (a list of actions to RUN — use Menu) and NOT a combobox (a select with a text filter — that is the next component built on this canon).',
    dos: [
      'Use for choosing from a closed set of values where radios would be too long or too prominent.',
      'Let the machine own navigation, typeahead, selection and dismiss — never re-implement them.',
      'Give the control a label (accessible name) and a placeholder so the empty trigger reads clearly.',
      'Set multiple only when several values can be chosen at once; the machine adds aria-multiselectable.',
    ],
    donts: [
      "Don't pour actions into it (Edit, Delete, Duplicate) — that is a Menu, semantically role=menu.",
      "Don't hand-roll a positioned div with a keydown handler; the machine owns positioning, roving and aria-activedescendant.",
      "Don't key options by index — options can be filtered/reordered; the machine and the element key by value.",
      "Don't use it as a free-text input; a combobox (select + filter) is the right control there.",
    ],
  },

  liveExample: {
    make: () => makeSelect({ size: 'm' }),
    // Honest live controls: size and placement are reflected attributes the machine
    // reads; multiple really flips single→multi selection (aria-multiselectable).
    // Clicking the trigger runs the Zag machine (open/navigate/select/dismiss).
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
      { kind: 'toggle', label: 'Multiple', attribute: 'multiple' },
      { kind: 'toggle', label: 'Disabled', attribute: 'disabled' },
    ],
  },

  api: {
    props: [
      {
        name: 'items',
        type: 'LabSelectItem[] ({ value, label, disabled? })',
        default: '[]',
        description:
          'The options. A JS property; a JSON string attribute is parsed for HTML/SSR. The machine resolves value/label/disabled through a collection built from this.',
      },
      {
        name: 'size',
        type: "'s' | 'm' | 'l'",
        default: "'m'",
        description: 'Control size — drives trigger height and listbox font band.',
      },
      {
        name: 'placement',
        type: "Placement ('bottom-start' | 'bottom-end' | 'top-start' | …)",
        default: "'bottom-start'",
        description: 'Where the listbox sits relative to the trigger (Zag popper).',
      },
      {
        name: 'multiple',
        type: 'boolean',
        default: 'false',
        description:
          'Multiple-selection mode — the machine sets aria-multiselectable on the listbox.',
      },
      {
        name: 'disabled',
        type: 'boolean',
        default: 'false',
        description: 'Trigger non-interactive when present. An option may also be disabled.',
      },
      {
        name: 'value',
        type: 'string[]',
        description:
          'Controlled selected value(s) — when set (JSON attribute or property), the consumer owns the value.',
      },
      {
        name: 'defaultValue',
        type: 'string[]',
        description: 'Uncontrolled initial value(s) — read once by the machine at init.',
      },
      {
        name: 'name',
        type: 'string',
        description: 'Field name of the hidden native <select> for forms.',
      },
      {
        name: 'placeholder',
        type: 'string',
        default: "'Select…'",
        description: 'Shown in the trigger when nothing is selected.',
      },
      { name: 'label', type: 'string', description: 'Optional control label (accessible name).' },
    ],
    events: [
      {
        name: 'value-change',
        description:
          'CustomEvent<ValueChangeDetails> fired when the machine changes the selected value(s). The machine is the source of truth.',
      },
      {
        name: 'open-change',
        description:
          'CustomEvent<OpenChangeDetails> fired when the machine opens or closes the listbox.',
      },
    ],
    slots: [],
  },
};
