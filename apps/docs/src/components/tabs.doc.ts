import '@labpics/ui-core/tabs';
import type { ComponentDoc } from '../template/component-doc.js';

function makeTabs(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const el = document.createElement('lab-tabs');
  el.items = [
    { value: 'draft', label: 'Draft' },
    { value: 'details', label: 'Details' },
    { value: 'history', label: 'History' },
  ];
  el.defaultValue = 'draft';
  el.label = 'Project views';
  el.innerHTML =
    '<label slot="draft">Project draft<textarea aria-label="Project draft" rows="3" style="display:block;box-sizing:border-box;width:100%;font:inherit">Write here, switch views, then return.</textarea></label><div slot="details">Project details stay beside the draft.</div><div slot="history">Earlier revisions appear here.</div>';
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== false) el.setAttribute(key, value === true ? '' : String(value));
  }
  return el;
}

const variant = {
  name: 'Variant',
  attribute: 'variant',
  options: [
    { label: 'Tinted', value: 'tinted' },
    { label: 'Underlined', value: 'underlined' },
  ],
};
const orientation = {
  name: 'Orientation',
  attribute: 'orientation',
  options: [
    { label: 'Horizontal', value: 'horizontal' },
    { label: 'Vertical', value: 'vertical' },
  ],
};
const edge = {
  name: 'Edge',
  attribute: 'edge',
  options: [
    { label: 'End', value: 'end' },
    { label: 'Start', value: 'start' },
  ],
};

export const tabsDoc: ComponentDoc = {
  slug: 'tabs',
  order: 9,
  tag: 'lab-tabs',
  title: 'Tabs',
  summary:
    'Switch between related views while keeping each panel and its unfinished work. Tinted and Underlined follow the LabUI author profile, with horizontal or vertical lists and a choice of indicator edge.',
  status: { kind: 'stable' },
  statesMatrix: { axes: [variant, orientation, edge], make: makeTabs },
  anatomy: [
    {
      index: 1,
      name: 'List',
      description:
        'A named tablist with one keyboard entry point. Long horizontal labels remain available through scrolling.',
    },
    {
      index: 2,
      name: 'Tab control',
      description:
        'A 48px medium control with optional leading or trailing icons. The selected label uses the primary neutral role.',
    },
    {
      index: 3,
      name: 'Selected surface',
      description:
        'Tinted uses the control background and Shadow/XS. Underlined uses a 1px strong border with Shadow/XS on the line.',
    },
    {
      index: 4,
      name: 'Panel',
      description:
        'A labelled, mounted panel. Hidden panels leave the keyboard and accessibility tree; their drafts remain intact.',
    },
  ],
  meaning: {
    purpose:
      'Use tabs for peer views of one subject that share a region, such as a draft, its details and its history.',
    dos: [
      'Give the tablist and every icon-only tab an accessible name.',
      'Keep stable values when reordering tabs or their panels.',
      'Use manual activation when changing views needs deliberate confirmation.',
    ],
    donts: [
      'Do not use tabs for sequential steps or page navigation.',
      'Do not remount a panel merely because it became hidden.',
    ],
  },
  liveExample: {
    make: () => makeTabs({ variant: 'tinted' }),
    controls: [
      ...[variant, orientation, edge].map((axis) => ({
        kind: 'select' as const,
        label: axis.name,
        attribute: axis.attribute,
        options: axis.options,
      })),
      {
        kind: 'select',
        label: 'Activation',
        attribute: 'activation-mode',
        options: [
          { label: 'Automatic', value: 'automatic' },
          { label: 'Manual', value: 'manual' },
        ],
      },
    ],
  },
  api: {
    props: [
      {
        name: 'items',
        type: 'LabTabItem[]',
        default: '[]',
        description:
          'Stable value, accessible label, disabled?, icon?, iconEnd?, iconOnly?. Icons name decorative slots; panel slots use item values.',
      },
      {
        name: 'value',
        type: 'string | null | undefined',
        default: 'undefined',
        description:
          'Controlled input. Undefined uses internal selection; null deliberately selects no panel. A request never changes this input.',
      },
      {
        name: 'selectedValue',
        type: 'string | null (read only)',
        default: 'null',
        description: 'The currently approved selection, including uncontrolled use.',
      },
      {
        name: 'default-value',
        type: 'string | null',
        default: 'null',
        description: 'Initial uncontrolled selection, read once when the group starts.',
      },
      {
        name: 'variant',
        type: "'tinted' | 'underlined'",
        default: "'underlined'",
        description: 'Authored group appearance.',
      },
      {
        name: 'orientation',
        type: "'horizontal' | 'vertical'",
        default: "'horizontal'",
        description:
          'List axis and arrow-key direction. Vertical panels wrap below when there is insufficient room.',
      },
      {
        name: 'edge',
        type: "'start' | 'end'",
        default: "'end'",
        description:
          'Cross-axis indicator edge: top/bottom horizontally; logical start/end vertically, mirrored in RTL.',
      },
      {
        name: 'size',
        type: "'s' | 'm' | 'l'",
        default: "'m'",
        description: 'Medium is the authored geometry; small and large are density extensions.',
      },
      {
        name: 'activation-mode',
        type: "'automatic' | 'manual'",
        default: "'automatic'",
        description:
          'Automatic selects on focus. Manual keeps selection until Enter, Space or click.',
      },
      {
        name: 'label',
        type: 'string',
        default: "''",
        description: 'Accessible name of the tablist. aria-label is also accepted.',
      },
      {
        name: 'dir',
        type: "'ltr' | 'rtl'",
        default: 'inherited',
        description:
          'Text direction and horizontal arrow-key mapping. Pass explicitly for matching server and client layout.',
      },
    ],
    events: [
      {
        name: 'value-change',
        description:
          'CustomEvent<{ value: string }> requests selection. In controlled mode assign value to accept; leave it unchanged to refuse.',
      },
    ],
    slots: [
      {
        name: '(item value)',
        description: 'Mounted panel content for the matching stable item value.',
      },
      {
        name: '(item icon / iconEnd)',
        description: 'Decorative leading or trailing icon. Use distinct names from panel slots.',
      },
    ],
  },
};
