/*
 * `lab-tabs` documentation config — the first COMPOUND component that consumes a
 * GROUP machine through the Behaviors seam (the compound canon, shared with Radio).
 *
 * The states matrix and live example render REAL `<lab-tabs>` elements with a
 * fixed demo tab set (set as the `.items` property) and per-value panel slots. The
 * `@zag-js/tabs` machine reads the reflected `orientation` / `size` /
 * `activation-mode` attributes, so the live controls genuinely drive it — and
 * clicking or arrow-keying a tab runs the machine (roving focus + selection).
 * Nothing is faked.
 */
import '@labpics/ui-core/tabs';
import type { LabTabItem } from '@labpics/ui-core/tabs';
import type { ComponentDoc } from '../template/component-doc.js';

const DEMO_TABS: ReadonlyArray<LabTabItem> = [
  { value: 'account', label: 'Account' },
  { value: 'password', label: 'Password' },
  { value: 'team', label: 'Team', disabled: true },
];

const DEMO_PANELS: ReadonlyArray<readonly [string, string]> = [
  ['account', 'Manage your account name and email.'],
  ['password', 'Update your password and two-factor security.'],
  ['team', 'Invite and manage team members.'],
];

/** Build a real `<lab-tabs>` with the demo tab set and the given attribute map. */
function makeTabs(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const el = document.createElement('lab-tabs');
  el.items = DEMO_TABS;
  for (const [value, text] of DEMO_PANELS) {
    const panel = document.createElement('div');
    panel.setAttribute('slot', value);
    panel.textContent = text;
    el.append(panel);
  }
  // Seed an uncontrolled selection so every matrix cell shows an active tab,
  // unless the cell explicitly controls the value.
  if (!('value' in attrs)) el.setAttribute('default-value', 'account');
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

export const tabsDoc: ComponentDoc = {
  slug: 'tabs',
  order: 9,
  tag: 'lab-tabs',
  title: 'Tabs',
  summary:
    'A set of layered panels where one tab is shown at a time. Runs the @zag-js/tabs GROUP machine through the LabUI seam: the machine owns selection, roving focus, arrow-key navigation, role="tablist"/tab/tabpanel and automatic-vs-manual activation — the element only paints with semantic --lab-* roles.',
  status: { kind: 'stable' },

  statesMatrix: {
    axes: [
      {
        name: 'Orientation',
        attribute: 'orientation',
        options: [
          { label: 'Horizontal', value: 'horizontal' },
          { label: 'Vertical', value: 'vertical' },
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
        name: 'Activation',
        attribute: 'activation-mode',
        options: [
          { label: 'Automatic', value: 'automatic' },
          { label: 'Manual', value: 'manual' },
        ],
      },
    ],
    make: makeTabs,
  },

  anatomy: [
    {
      index: 1,
      name: 'Root',
      description:
        'The Zag root element — the wrapper that scopes the machine. Lays the list and panels out along the orientation axis.',
    },
    {
      index: 2,
      name: 'List (tablist)',
      description:
        'The Zag list element — role="tablist". A flex track with a --lab-border-base divider that owns roving focus across the triggers.',
    },
    {
      index: 3,
      name: 'Trigger (tab)',
      description:
        'The Zag trigger element — role="tab". Idle reads --lab-label-secondary; the selected tab reads --lab-label-accent with an --lab-fill-accent underline (drawn on a transparent border so nothing shifts).',
    },
    {
      index: 4,
      name: 'Panel (tabpanel)',
      description:
        'The Zag content element — role="tabpanel". Rich content projects from light DOM via a per-value named slot; the unselected panels are hidden by the machine.',
    },
  ],

  meaning: {
    purpose:
      'Tabs organise related content into layered sections shown one at a time, so a single region serves several views without a full navigation. Use them when the views are peers (Account / Password / Team) and the user switches between them in place. They are NOT site navigation (that changes the URL/page — use links/breadcrumb) and NOT a wizard (tabs have no required order).',
    dos: [
      'Use for peer views of one subject that share a region (settings panes, detail sub-views).',
      'Keep the trigger labels short and parallel — they sit on one line.',
      'Let the machine own selection and focus — read value-change, never fight aria-selected by hand.',
    ],
    donts: [
      "Don't use tabs for sequential steps that must be completed in order — that is a wizard/stepper.",
      "Don't use tabs to navigate between pages — that changes location, which is a link's job.",
      "Don't hide critical content behind a tab the user is unlikely to open.",
    ],
  },

  liveExample: {
    make: () => makeTabs({}),
    // Honest live controls: orientation / size / activation-mode are reflected
    // attributes the machine reads on update, so flipping them really re-drives the
    // element. Clicking a tab or arrow-keying runs the Zag machine — the primary
    // interaction.
    controls: [
      {
        kind: 'select',
        label: 'Orientation',
        attribute: 'orientation',
        options: [
          { label: 'Horizontal', value: 'horizontal' },
          { label: 'Vertical', value: 'vertical' },
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
          'The tabs to render: { value, label, disabled? }. A JS property (not an attribute). Panel content projects via a per-value named slot.',
      },
      {
        name: 'value',
        type: 'string | null',
        default: 'null',
        description:
          'Controlled selected tab. Reflected for CSS + SSR. When present, the consumer owns it; otherwise the machine owns it from default-value.',
      },
      {
        name: 'default-value',
        type: 'string | null',
        default: 'null',
        description: 'Uncontrolled initial selection — read once by the machine at init.',
      },
      {
        name: 'orientation',
        type: "'horizontal' | 'vertical'",
        default: "'horizontal'",
        description: 'List axis. Drives the arrow-key navigation direction.',
      },
      {
        name: 'size',
        type: "'s' | 'm' | 'l'",
        default: "'m'",
        description: 'Trigger density.',
      },
      {
        name: 'activation-mode',
        type: "'automatic' | 'manual'",
        default: "'automatic'",
        description: 'Automatic selects a tab as it receives focus; manual waits for Enter/Space.',
      },
    ],
    events: [
      {
        name: 'value-change',
        description:
          'CustomEvent<{ value: string }> fired when the machine selects a different tab. The machine is the source of truth.',
      },
    ],
    slots: [
      {
        name: '(per value)',
        description:
          'A named slot per tab (slot="<value>") carrying that panel\'s content, projected into the machine-wired panel wrapper.',
      },
    ],
  },
};
