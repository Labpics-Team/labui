/*
 * `lab-progress` documentation config — a component that CONSUMES the
 * @zag-js/progress machine through the Behaviors seam (a single, non-group machine
 * like Switch).
 *
 * The states matrix and live example render REAL `<lab-progress>` elements. The
 * machine reads the `value` / `min` / `max` properties and derives the percent,
 * the ARIA, and the determinate-vs-indeterminate state — so BOTH modes shown here
 * are genuine: a determinate bar fills to a real percent with a real aria-valuenow;
 * an indeterminate bar (value=null) drops aria-valuenow and animates an honest
 * unknown-progress segment. No fake progress.
 */
import '@labpics/ui-core/progress';
import type { ComponentDoc } from '../template/component-doc.js';

/** Build a real `<lab-progress>` with a sensible demo value and the given attrs. */
function makeProgress(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const el = document.createElement('lab-progress');
  el.setAttribute('label', 'Uploading');
  el.setAttribute('show-value-text', '');
  // A real default value; cells that set `value` (including "null" for
  // indeterminate) override it. Nothing is faked — null IS the indeterminate
  // signal the machine reads.
  if (!('value' in attrs)) el.setAttribute('value', '60');
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

export const progressDoc: ComponentDoc = {
  slug: 'progress',
  order: 14,
  tag: 'lab-progress',
  title: 'Progress',
  summary:
    'A linear bar showing how far a task has advanced. Runs the @zag-js/progress machine through the LabUI seam: the machine owns the value→percent maths, role="progressbar" + aria-valuemin/max/now, and the determinate-vs-indeterminate state. The progressbar is named by its visible label via aria-labelledby (WCAG 4.1.2). Both modes are real — an indeterminate bar honestly drops aria-valuenow instead of faking a percent.',
  status: { kind: 'stable' },

  statesMatrix: {
    axes: [
      {
        name: 'Mode',
        attribute: 'value',
        options: [
          { label: 'Determinate (30%)', value: '30' },
          { label: 'Determinate (80%)', value: '80' },
          { label: 'Complete (100%)', value: '100' },
          { label: 'Indeterminate', value: 'null' },
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
    make: makeProgress,
  },

  anatomy: [
    {
      index: 1,
      name: 'Root',
      description:
        'The Zag root element — carries data-state (loading / complete / indeterminate) and the --percent custom property the determinate fill reads.',
    },
    {
      index: 2,
      name: 'Label',
      description: 'The Zag label element — an optional visible label reading --lab-label-primary.',
    },
    {
      index: 3,
      name: 'Value text',
      description:
        'The Zag valueText element (aria-live="polite") — the formatted percent. Empty for indeterminate by the machine’s own contract (no faked number).',
    },
    {
      index: 4,
      name: 'Track (progressbar)',
      description:
        'The Zag track element — role="progressbar" with aria-valuemin / aria-valuemax / aria-valuenow. A --lab-fill-primary rail.',
    },
    {
      index: 5,
      name: 'Range',
      description:
        'The Zag range element — the --lab-fill-accent fill. Its width is the machine’s real percent (determinate) or an animated segment (indeterminate), never a fabricated value.',
    },
  ],

  meaning: {
    purpose:
      'A progress bar tells the user how much of a task is done and that the system is still working. Use determinate progress when you can measure the work (file upload, multi-step import) and indeterminate when you genuinely cannot (waiting on a server that reports no fraction). The honesty rule is the whole point: if you do not know the percent, show indeterminate — never animate a fake bar toward an invented number.',
    dos: [
      'Use determinate when you can measure the fraction done (bytes uploaded, items processed).',
      'Use indeterminate (value=null) when the duration is genuinely unknown — the machine drops aria-valuenow.',
      'Give it a label and value text for tasks the user is actively waiting on.',
    ],
    donts: [
      "Don't fake a determinate bar when you don't know the percent — use indeterminate instead.",
      "Don't use a progress bar for a single instantaneous action — a loader/spinner fits better.",
      "Don't hide the bar the moment it hits 100% — let the complete state register first.",
    ],
  },

  liveExample: {
    make: () => makeProgress({ value: '45' }),
    // Honest live controls: value selects a real determinate percent OR "null" for
    // genuine indeterminate (the machine's own signal); size is a reflected
    // attribute. Nothing here fabricates progress.
    controls: [
      {
        kind: 'select',
        label: 'Value',
        attribute: 'value',
        options: [
          { label: '0%', value: '0' },
          { label: '45%', value: '45' },
          { label: '100%', value: '100' },
          { label: 'Indeterminate', value: 'null' },
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
        name: 'value',
        type: 'number | null',
        default: 'null',
        description:
          'The current value. A number is determinate (fills to the real percent, sets aria-valuenow); null is indeterminate (drops aria-valuenow, animates an unknown-progress segment).',
      },
      {
        name: 'min',
        type: 'number',
        default: '0',
        description: 'Lower bound of the value range (machine-owned percent maths).',
      },
      {
        name: 'max',
        type: 'number',
        default: '100',
        description: 'Upper bound of the value range.',
      },
      {
        name: 'size',
        type: "'s' | 'm' | 'l'",
        default: "'m'",
        description: 'Track thickness.',
      },
      {
        name: 'label',
        type: 'string',
        default: "''",
        description: 'Optional visible label rendered as the machine’s label part.',
      },
      {
        name: 'show-value-text',
        type: 'boolean',
        default: 'false',
        description:
          'Show the formatted percent next to the label. Determinate only — empty for indeterminate.',
      },
    ],
    events: [],
    slots: [],
  },
};
