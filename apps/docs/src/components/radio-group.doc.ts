/*
 * `lab-radio-group` documentation config — the FIRST COMPOUND component, a group
 * machine that owns N radio items through the Behaviors seam.
 *
 * Compound note: a Zag *group* machine is ONE instance whose `connect()` returns
 * group getters (root, label) AND per-value item getters (item, control, text,
 * hidden input). The Web-Component renders every part in ONE shadow scope from a
 * declarative `items` config, because the machine queries the DOM through a
 * single `getRootNode`. So the matrix/live `make` set the `items` PROPERTY (an
 * array can't ride a plain attribute) and apply the axis attributes on top.
 */
import '@labpics/ui-core/radio-group';
import type { LabRadioItem } from '@labpics/ui-core/radio-group';
import type { ComponentDoc } from '../template/component-doc.js';

/** The fixed option set every specimen shows — enough to read selection + roving. */
const ITEMS: readonly LabRadioItem[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'express', label: 'Express' },
  { value: 'overnight', label: 'Overnight', disabled: true },
];

/**
 * Build a real `<lab-radio-group>` with the given attribute map applied, the
 * `items` set as a property, and a pre-selected value so the checked dot shows.
 */
function makeRadioGroup(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const el = document.createElement('lab-radio-group');
  // `items` is a property (an array can't be a plain attribute) — the COMPOUND
  // config the group spreads its per-item getters onto.
  (el as HTMLElement & { items: readonly LabRadioItem[] }).items = ITEMS;
  el.setAttribute('label', 'Delivery speed');
  el.setAttribute('value', 'express');
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

export const radioGroupDoc: ComponentDoc = {
  slug: 'radio-group',
  order: 8,
  tag: 'lab-radio-group',
  title: 'Radio Group',
  summary:
    'A single-select group of radio options — the first COMPOUND LabUI component. Runs the @zag-js/radio-group machine through the LabUI seam: one group machine owns the selected value, roving focus, Arrow-key selection and aria-checked across every item.',
  status: { kind: 'stable' },

  statesMatrix: {
    axes: [
      {
        name: 'Type',
        attribute: 'type',
        options: [
          { label: 'Accent', value: 'accent' },
          { label: 'Neutral', value: 'neutral' },
          { label: 'Danger', value: 'danger' },
        ],
      },
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
        name: 'Orientation',
        attribute: 'orientation',
        options: [
          { label: 'Horizontal', value: 'horizontal' },
          { label: 'Vertical', value: 'vertical' },
        ],
      },
      {
        name: 'Disabled',
        attribute: 'disabled',
        options: [
          { label: 'Enabled', value: false },
          { label: 'Disabled', value: true },
        ],
      },
    ],
    make: (attrs) => makeRadioGroup(attrs),
  },

  anatomy: [
    {
      index: 1,
      name: 'Root (radiogroup)',
      description:
        'The Zag root element — role="radiogroup" with roving tabindex and Arrow-key selection. Lays the items out horizontally or vertically per the orientation axis; reads --lab-label-primary for text.',
    },
    {
      index: 2,
      name: 'Group label',
      description:
        'The Zag label element, linked to the root via aria-labelledby so the whole group has one accessible name. Clicking it focuses the active radio.',
    },
    {
      index: 3,
      name: 'Item (label)',
      description:
        'One Zag item element per option — a <label> wrapping the ring, text and hidden input, so clicking anywhere on the row selects it. Carries the machine’s data-state ("checked"/"unchecked") and data-disabled.',
    },
    {
      index: 4,
      name: 'Ring + dot (item control)',
      description:
        'The Zag item-control element: a circular ring bordered with --lab-border-neutral, filling to --lab-border-{type} when checked, with an inner dot in --lab-fill-{type} that scales in. The machine’s data-state drives it — not hand-rolled.',
    },
    {
      index: 5,
      name: 'Hidden input + focus ring',
      description:
        'One Zag hidden native <input type="radio"> per item keeps the group in the form + a11y tree and carries roving focus; a :focus-visible ring from --lab-border-focus shows on the ring of the focused item.',
    },
  ],

  meaning: {
    purpose:
      'A radio group commits to exactly one choice from a small, mutually exclusive set, shown all at once. It is COMPOUND: one group machine owns the single selected value and the roving focus across every item — selecting one clears the rest. Use it when the options are few (2–5) and worth seeing side by side; for many options a Select is better.',
    dos: [
      'Use for 2–5 mutually exclusive options the user should see at a glance.',
      'Give the group a label — the machine wires it as the radiogroup’s accessible name.',
      'Let the machine own selection and roving focus — read value-change, never re-implement Arrow-key navigation.',
    ],
    donts: [
      "Don't use it for many options or free text — that is a Select or an Input.",
      "Don't use it for an independent on/off — that is a Switch or a Checkbox.",
      "Don't hardcode colours against it — it only ever reads --lab-* roles bound by an ancestor.",
    ],
  },

  liveExample: {
    make: () => makeRadioGroup({}),
    // Honest live controls: type/size/orientation are reflected attributes the
    // element reads, and disabled is the group-level machine prop. Selecting a
    // radio (click or Arrow keys) runs the machine, which moves the checked dot.
    controls: [
      {
        kind: 'select',
        label: 'Type',
        attribute: 'type',
        options: [
          { label: 'Accent', value: 'accent' },
          { label: 'Neutral', value: 'neutral' },
          { label: 'Danger', value: 'danger' },
        ],
      },
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
        label: 'Orientation',
        attribute: 'orientation',
        options: [
          { label: 'Horizontal', value: 'horizontal' },
          { label: 'Vertical', value: 'vertical' },
        ],
      },
      { kind: 'toggle', label: 'Disabled', attribute: 'disabled' },
    ],
  },

  api: {
    props: [
      {
        name: 'type',
        type: "'accent' | 'neutral' | 'danger'",
        default: "'accent'",
        description: 'Semantic intent of the selected dot + ring.',
      },
      {
        name: 'size',
        type: "'s' | 'm' | 'l'",
        default: "'m'",
        description: 'Control size.',
      },
      {
        name: 'orientation',
        type: "'horizontal' | 'vertical'",
        default: "'horizontal'",
        description:
          'Layout direction. The machine maps it to the roving Arrow keys. Reflected for CSS + SSR.',
      },
      {
        name: 'value',
        type: 'string',
        default: "''",
        description: 'Controlled selected value. Reflected for CSS + SSR.',
      },
      {
        name: 'default-value',
        type: 'string',
        default: "''",
        description: 'Uncontrolled initial value — read once by the machine at init.',
      },
      {
        name: 'disabled',
        type: 'boolean',
        default: 'false',
        description: 'Disables the whole group. An individual item may also be disabled.',
      },
      {
        name: 'name',
        type: 'string',
        default: "''",
        description: 'Native form field name for the hidden radio inputs.',
      },
      {
        name: 'label',
        type: 'string',
        default: "''",
        description: 'Group label text, rendered as the machine’s label part (accessible name).',
      },
      {
        name: 'items',
        type: 'LabRadioItem[]',
        default: '[]',
        description:
          'The options: { value, label, disabled? }. A JS property (an array can’t ride a plain attribute); a JSON string attribute is parsed for pure-HTML/SSR use.',
      },
    ],
    events: [
      {
        name: 'value-change',
        description:
          'CustomEvent<{ value: string | null }> fired when the Zag machine changes the selected value. The machine is the source of truth.',
      },
    ],
    slots: [],
  },
};
