/*
 * `lab-combobox` documentation config — the COMPOUND + POSITIONED + FILTERED canon: a
 * text input that NARROWS a positioned listbox of options as the user types. It FUSES
 * the Select listbox (machine-positioned, dismissable) with a typeable input and the
 * shared form-field a11y seam (label / helper / error association).
 *
 * The matrix and live example render REAL `<lab-combobox>` elements. The listbox is
 * hidden until the machine opens it (on focus / type), so the grid shows the live
 * INPUTS across size and sentiment; focusing any cell genuinely opens the listbox,
 * filters as you type, navigates with Arrow/Home/End, selects on Enter/click, and
 * dismisses on Escape / outside-click — all from the @zag-js/combobox machine, nothing
 * faked. The live controls re-point the same axes the machine reads.
 */
import '@labpics/ui-core/combobox';
import type { LabComboboxItem } from '@labpics/ui-core/combobox';
import type { ComponentDoc } from '../template/component-doc.js';

/** The shared option set for every documented specimen. */
const FRUITS: readonly LabComboboxItem[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'apricot', label: 'Apricot' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'durian', label: 'Durian', disabled: true },
  { value: 'elderberry', label: 'Elderberry' },
];

/** Build a real `<lab-combobox>` with the given attribute map applied. The options ride
 * the JSON `items` attribute; a `placeholder` makes the empty input legible. */
function makeCombobox(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const el = document.createElement('lab-combobox');
  el.setAttribute('items', JSON.stringify(FRUITS));
  el.setAttribute('placeholder', 'Search a fruit…');
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

export const comboboxDoc: ComponentDoc = {
  slug: 'combobox',
  order: 13,
  tag: 'lab-combobox',
  title: 'Combobox',
  summary:
    'A text input with a filterable listbox (autocomplete / typeahead). Runs the @zag-js/combobox machine through the LabUI seam: the machine owns open-on-focus/type, the filterable listbox, single/multiple selection, Arrow/Home/End navigation, Escape / outside-click dismiss, focus restoration, role="combobox"/listbox/option + aria-expanded/controls/activedescendant/autocomplete, and dynamic positioning (Floating UI). The typed query narrows the options (the shared default filter). It REUSES the shared field-a11y helper for the label / helper / error association — the same seam as Input — so the ARIA contract is one source of truth across both renderers. The element only paints with semantic --lab-* roles.',
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
        name: 'Sentiment',
        attribute: 'type',
        options: [
          { label: 'Neutral', value: 'neutral' },
          { label: 'Danger', value: 'danger' },
          { label: 'Warning', value: 'warning' },
          { label: 'Success', value: 'success' },
        ],
      },
    ],
    make: makeCombobox,
  },

  anatomy: [
    {
      index: 1,
      name: 'Label',
      description:
        'A real <label for> naming the input — the field-a11y seam (shared with Input). Its id is the machine label part, so the combobox has an accessible name.',
    },
    {
      index: 2,
      name: 'Control',
      description:
        'The Zag control — a layout frame around the input and the toggle trigger. The machine spreads data attributes on it; the field surface (border / focus ring / sentiment) is reused from the shared field-styles.',
    },
    {
      index: 3,
      name: 'Input (combobox)',
      description:
        'The Zag input — a real <input role="combobox">. The machine spreads aria-autocomplete, aria-expanded, aria-controls → content id, aria-activedescendant → the highlighted option, and the typed value. The shared field-a11y helper adds aria-describedby (helper + error) / aria-invalid / aria-errormessage / aria-required on top — merged, not overwritten.',
    },
    {
      index: 4,
      name: 'Trigger',
      description:
        'The disclosure caret — the Zag trigger, a real <button> that toggles the listbox. It rotates when open (the machine sets data-state="open").',
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
        'One VISIBLE option — role="option", keyed by data-value. Only options matching the typed query are rendered. The machine sets aria-selected + data-state="checked" on the chosen option and data-highlighted on the navigated one. The selected label is --lab-label-accent; the highlight fill is --lab-fill-neutral-tinted.',
    },
    {
      index: 8,
      name: 'Helper / Error',
      description:
        'Description text below the input (linked via aria-describedby) and, when invalid + a message exists, an error region announced via role="alert" and linked via aria-errormessage — the field-a11y seam, identical on both renderers.',
    },
  ],

  meaning: {
    purpose:
      'A combobox lets a user pick one value (or several, when multiple) from a list that is TOO LONG to scan, by typing to narrow it. It is a Select with a text filter — built on the same compound + positioned listbox canon — plus the form-field a11y of an Input. It opens on focus/type, filters as the user types, navigates by keyboard (Arrow/Home/End), and dismisses on Escape or outside-click with focus returning to the input. It is NOT a Select (no free-text filtering — use Select for a short closed list) and NOT a Menu (a list of actions to RUN).',
    dos: [
      'Use when the option list is long enough that typing to filter beats scrolling — autocomplete / typeahead.',
      'Let the machine own navigation, selection and dismiss, and let the shared filter own narrowing — never re-implement them.',
      'Give the control a label (accessible name), a placeholder, and a helper so the empty input reads clearly.',
      'Set multiple only when several values can be chosen at once; the machine adds aria-multiselectable.',
    ],
    donts: [
      "Don't use it for a short closed list where no filtering helps — a Select is the simpler control there.",
      "Don't hand-roll a filtered div with a keydown handler; the machine owns positioning, roving and aria-activedescendant.",
      "Don't key options by index — the filtered list reorders/shrinks every keystroke; the machine and the element key by value.",
      "Don't duplicate the label/helper/error a11y — reuse the shared field-a11y seam, exactly as Input does.",
    ],
  },

  liveExample: {
    make: () => makeCombobox({ size: 'm', helper: 'Type to filter the list.' }),
    // Honest live controls: size, sentiment and placement are reflected attributes the
    // machine / field-styles read; multiple really flips single→multi selection
    // (aria-multiselectable). Typing in the input runs the Zag machine (filter / open /
    // navigate / select / dismiss).
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
        label: 'Sentiment',
        attribute: 'type',
        options: [
          { label: 'Neutral', value: 'neutral' },
          { label: 'Danger', value: 'danger' },
          { label: 'Warning', value: 'warning' },
          { label: 'Success', value: 'success' },
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
      { kind: 'toggle', label: 'Invalid', attribute: 'invalid' },
    ],
  },

  api: {
    props: [
      {
        name: 'items',
        type: 'LabComboboxItem[] ({ value, label, disabled? })',
        default: '[]',
        description:
          'The options. A JS property; a JSON string attribute is parsed for HTML/SSR. The typed query narrows them (shared filter); the machine resolves value/label/disabled through a collection built from the visible subset.',
      },
      {
        name: 'type',
        type: "'neutral' | 'danger' | 'warning' | 'success'",
        default: "'neutral'",
        description: 'Field sentiment — drives the input border / label colour (the field axis).',
      },
      {
        name: 'size',
        type: "'s' | 'm' | 'l'",
        default: "'m'",
        description: 'Control size — drives input height and listbox font band.',
      },
      {
        name: 'placement',
        type: "Placement ('bottom-start' | 'bottom-end' | 'top-start' | …)",
        default: "'bottom-start'",
        description: 'Where the listbox sits relative to the input (Zag popper).',
      },
      {
        name: 'multiple',
        type: 'boolean',
        default: 'false',
        description:
          'Multiple-selection mode — the machine sets aria-multiselectable on the listbox.',
      },
      {
        name: 'disabled / readonly / required / invalid',
        type: 'boolean',
        default: 'false',
        description:
          'The field states. disabled/readonly gate interaction; required/invalid drive the field a11y (aria-required / aria-invalid / aria-errormessage) and the sentiment styling.',
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
        description: 'Field name of the combobox input for form submission.',
      },
      {
        name: 'placeholder',
        type: 'string',
        description: 'Shown in the input when empty.',
      },
      { name: 'label', type: 'string', description: 'Visible label text (accessible name).' },
      {
        name: 'helper / error',
        type: 'string',
        description:
          'Description text below the input (linked via aria-describedby), and an error message announced + linked only when invalid — the shared field-a11y seam.',
      },
    ],
    events: [
      {
        name: 'value-change',
        description:
          'CustomEvent<ValueChangeDetails> fired when the machine changes the selected value(s). The machine is the source of truth.',
      },
      {
        name: 'input-value-change',
        description:
          'CustomEvent<InputValueChangeDetails> fired when the typed query changes (drives the filter).',
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
