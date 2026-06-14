/*
 * `lab-accordion` documentation config — a COMPOUND component that consumes the
 * @zag-js/accordion GROUP machine through the Behaviors seam (the compound canon,
 * shared with Radio and Tabs).
 *
 * The states matrix and live example render REAL `<lab-accordion>` elements with a
 * fixed demo item set (set as the `.items` property) and per-value panel slots.
 * The machine reads the reflected `orientation` / `size` and the boolean
 * `multiple` / `collapsible` props, so the live controls genuinely drive it —
 * clicking or arrow-keying a header runs the machine (open/close + roving focus).
 * Nothing is faked.
 */
import '@labpics/ui-core/accordion';
import type { LabAccordionItem } from '@labpics/ui-core/accordion';
import type { ComponentDoc } from '../template/component-doc.js';

const DEMO_ITEMS: ReadonlyArray<LabAccordionItem> = [
  { value: 'what', label: 'What is LabUI?' },
  { value: 'how', label: 'How does theming work?' },
  { value: 'ssr', label: 'Is it SSR-ready?', disabled: true },
];

const DEMO_PANELS: ReadonlyArray<readonly [string, string]> = [
  ['what', 'A cross-stack component system: one Lit core, native renderers per framework.'],
  ['how', 'Components read only semantic --lab-* roles; flipping the theme re-skins everything.'],
  ['ssr', 'Yes — the declarative shadow DOM emits styled content before any JS upgrades it.'],
];

/** Build a real `<lab-accordion>` with the demo item set and the given attribute map. */
function makeAccordion(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const el = document.createElement('lab-accordion');
  el.items = DEMO_ITEMS;
  for (const [value, text] of DEMO_PANELS) {
    const panel = document.createElement('div');
    panel.setAttribute('slot', value);
    panel.textContent = text;
    el.append(panel);
  }
  // Seed an open panel so every matrix cell shows an expanded state.
  el.defaultValue = ['what'];
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

export const accordionDoc: ComponentDoc = {
  slug: 'accordion',
  order: 12,
  tag: 'lab-accordion',
  title: 'Accordion',
  summary:
    'A stack of headers that expand and collapse their panels. Runs the @zag-js/accordion GROUP machine through the LabUI seam: the machine owns the open state, single-vs-multi disclosure, role="region"/aria-expanded/aria-controls/aria-labelledby wiring, roving keyboard navigation and focus — the element only paints with semantic --lab-* roles.',
  status: { kind: 'stable' },

  statesMatrix: {
    axes: [
      {
        name: 'Multiple',
        attribute: 'multiple',
        options: [
          { label: 'Single', value: false },
          { label: 'Multiple', value: true },
        ],
      },
      {
        name: 'Collapsible',
        attribute: 'collapsible',
        options: [
          { label: 'Fixed-open', value: false },
          { label: 'Collapsible', value: true },
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
    ],
    make: makeAccordion,
  },

  anatomy: [
    {
      index: 1,
      name: 'Root',
      description:
        'The Zag root element — the wrapper that scopes the machine. A bordered, rounded --lab-border-base container laid out along the orientation axis.',
    },
    {
      index: 2,
      name: 'Item',
      description:
        'One disclosure unit — the Zag item element. Stacks a header and its content; a --lab-border-base divider separates items.',
    },
    {
      index: 3,
      name: 'Trigger (header)',
      description:
        'The Zag item-trigger element — a real <button> carrying aria-expanded + aria-controls. Idle reads --lab-label-primary; the open header reads --lab-label-accent.',
    },
    {
      index: 4,
      name: 'Indicator',
      description:
        'The Zag item-indicator element — a decorative (aria-hidden) chevron that rotates when the machine reports the item open.',
    },
    {
      index: 5,
      name: 'Content (region)',
      description:
        'The Zag item-content element — role="region", aria-labelledby its trigger. Rich content projects from light DOM via a per-value named slot; the machine hides closed panels.',
    },
  ],

  meaning: {
    purpose:
      "An accordion shows a list of headers and reveals one header's panel at a time (or several, when multiple), so a long page of sections collapses to a scannable list the user expands on demand. Use it to tame secondary or reference content — FAQs, settings groups, detail sections. It is NOT navigation (that changes the page — use links) and NOT a wizard (an accordion has no required order).",
    dos: [
      'Use for collapsible sections of one page where the user opens what they need (FAQ, settings groups).',
      'Keep header labels short and self-describing — they are the only thing visible when collapsed.',
      'Let the machine own open state and focus — read value-change, never fight aria-expanded by hand.',
    ],
    donts: [
      "Don't hide critical, always-needed content behind a collapsed header.",
      "Don't use an accordion for sequential steps that must be completed in order — that is a stepper.",
      "Don't nest accordions deeply — the roving focus and the visual hierarchy both degrade.",
    ],
  },

  liveExample: {
    make: () => makeAccordion({}),
    // Honest live controls: multiple / collapsible are boolean props the machine
    // reads; size / orientation are reflected attributes it reads on update — so
    // flipping them really re-drives the element. Clicking or arrow-keying a header
    // runs the Zag machine — the primary interaction.
    controls: [
      { kind: 'toggle', label: 'Multiple', attribute: 'multiple' },
      { kind: 'toggle', label: 'Collapsible', attribute: 'collapsible' },
      {
        kind: 'select',
        label: 'Orientation',
        attribute: 'orientation',
        options: [
          { label: 'Vertical', value: 'vertical' },
          { label: 'Horizontal', value: 'horizontal' },
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
    ],
  },

  api: {
    props: [
      {
        name: 'items',
        type: 'LabAccordionItem[]',
        default: '[]',
        description:
          'The panels to render: { value, label, disabled? }. A JS property (not an attribute). Panel content projects via a per-value named slot.',
      },
      {
        name: 'value',
        type: 'string[] | null',
        default: 'null',
        description:
          'Controlled open value(s). When set, the consumer owns the open state; otherwise the machine owns it from default-value.',
      },
      {
        name: 'defaultValue',
        type: 'string[] | null',
        default: 'null',
        description: 'Uncontrolled initial open value(s) — read once by the machine at init.',
      },
      {
        name: 'multiple',
        type: 'boolean',
        default: 'false',
        description: 'Allow many panels open at once. When false, opening one closes the others.',
      },
      {
        name: 'collapsible',
        type: 'boolean',
        default: 'false',
        description:
          'In single mode, allow the open panel to be closed back to none. Ignored when multiple is true.',
      },
      {
        name: 'orientation',
        type: "'vertical' | 'horizontal'",
        default: "'vertical'",
        description: 'Layout axis and the arrow-key navigation direction across the headers.',
      },
      {
        name: 'size',
        type: "'s' | 'm' | 'l'",
        default: "'m'",
        description: 'Header density.',
      },
      {
        name: 'disabled',
        type: 'boolean',
        default: 'false',
        description: 'Group-level disable — every header becomes non-interactive.',
      },
    ],
    events: [
      {
        name: 'value-change',
        description:
          'CustomEvent<{ value: string[] }> fired when the machine opens or closes a panel. The machine is the source of truth.',
      },
    ],
    slots: [
      {
        name: '(per value)',
        description:
          'A named slot per panel (slot="<value>") carrying that panel\'s content, projected into the machine-wired content region.',
      },
    ],
  },
};
