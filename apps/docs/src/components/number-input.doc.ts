/*
 * `lab-number-input` documentation config — a MACHINE-DRIVEN numeric form field. It
 * runs the @zag-js/number-input machine through the LabUI seam (the machine owns the
 * parsed value, min/max/step clamping, the spinbutton role + value ARIA, Arrow/PageUp-
 * Down keyboard stepping, and the +/- triggers that disable at the bounds) AND reuses
 * the SAME shared `field-a11y` helper as Input/Textarea for the label/helper/error
 * association — so the matrix below documents real ARIA, not a faked role.
 */
import '@labpics/ui-core/number-input';
import type { ComponentDoc } from '../template/component-doc.js';

/** Build a real `<lab-number-input>` with the given attribute map applied. */
function makeNumberInput(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const el = document.createElement('lab-number-input');
  el.setAttribute('label', 'Quantity');
  el.setAttribute('default-value', '3');
  el.setAttribute('min', '0');
  el.setAttribute('max', '10');
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

export const numberInputDoc: ComponentDoc = {
  slug: 'number-input',
  order: 9,
  tag: 'lab-number-input',
  title: 'Number Input',
  summary:
    'A numeric form field: a real <input role="spinbutton"> with increment/decrement triggers, min/max/step clamping, and format/parse. Runs the @zag-js/number-input machine through the LabUI seam (the machine owns the value, clamping, the spinbutton role + aria-valuenow/valuemin/valuemax/valuetext, keyboard stepping, and the triggers that disable at the bounds) and reuses the shared field-a11y helper for the label/helper/error association.',
  status: { kind: 'stable' },

  statesMatrix: {
    axes: [
      {
        name: 'Type',
        attribute: 'type',
        options: [
          { label: 'Neutral', value: 'neutral' },
          { label: 'Danger', value: 'danger' },
          { label: 'Warning', value: 'warning' },
          { label: 'Success', value: 'success' },
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
        name: 'State',
        attribute: 'disabled',
        options: [
          { label: 'Enabled', value: false },
          { label: 'Disabled', value: true },
        ],
      },
    ],
    make: makeNumberInput,
  },

  anatomy: [
    {
      index: 1,
      name: 'Label',
      description:
        'A real <label for> bound to the input (the machine spreads htmlFor → the input id). Reads --lab-label-secondary; a required field appends a danger-coloured mark. The label/helper/error association is the shared field-a11y contract.',
    },
    {
      index: 2,
      name: 'Control (group)',
      description:
        'The Zag control — role="group" wrapping the input and the trigger stack. Resting border is --lab-border-base; hover is --lab-border-strong; the sentiment type re-points it to --lab-border-{danger|warning|success}.',
    },
    {
      index: 3,
      name: 'Input (spinbutton)',
      description:
        'The native <input> the machine makes role="spinbutton" with aria-valuenow/valuemin/valuemax/valuetext + aria-roledescription="numberfield". The machine owns parsing, clamping, and Arrow/PageUp-Down stepping. Text is --lab-label-primary; the placeholder is --lab-label-tertiary.',
    },
    {
      index: 4,
      name: 'Increment / decrement triggers',
      description:
        'Two real <button>s the machine drives — they step by the step prop and the machine sets data-disabled on each at the bounds (canIncrement / canDecrement). The surface is --lab-fill-primary, hairline-separated by --lab-border-soft.',
    },
    {
      index: 5,
      name: 'Helper + error',
      description:
        'Optional helper (--lab-label-tertiary) linked via aria-describedby; when invalid with a message, an error (role="alert", --lab-label-danger) is announced and referenced via aria-invalid + aria-errormessage — exactly the shared field-a11y rule.',
    },
  ],

  meaning: {
    purpose:
      'A number input collects a single numeric value inside a form, with steppable controls and a clamped range. The machine owns the value, parsing/formatting, clamp-on-blur, the spinbutton ARIA and keyboard stepping; the field owns the label/helper/error association. Use it when the value is a bounded number the user adjusts up/down (quantity, count, rating), not free text and not a continuous range (use Slider for that).',
    dos: [
      'Set min, max and step so the machine clamps the value and disables the triggers at the bounds.',
      'Always pass a label; pair invalid with an error message so the error is announced and referenced.',
      'Let the machine own stepping (Arrow/PageUp-Down, the +/- triggers) and clamping — never re-implement them.',
    ],
    donts: [
      "Don't hand-roll the spinbutton role or aria-valuenow — the machine owns the value ARIA.",
      "Don't use it for a continuous, drag-adjusted range; that is a Slider.",
      "Don't set invalid with no error message; an empty error region is never referenced.",
    ],
  },

  liveExample: {
    make: () => makeNumberInput({ helper: 'Between 0 and 10.' }),
    controls: [
      { kind: 'toggle', label: 'Required', attribute: 'required' },
      { kind: 'toggle', label: 'Invalid', attribute: 'invalid' },
      { kind: 'toggle', label: 'Disabled', attribute: 'disabled' },
      { kind: 'toggle', label: 'Read-only', attribute: 'readonly' },
      {
        kind: 'select',
        label: 'Type',
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
        name: 'type',
        type: "'neutral' | 'danger' | 'warning' | 'success'",
        default: "'neutral'",
        description: 'Sentiment of the field — re-points the border + focus ring.',
      },
      { name: 'size', type: "'s' | 'm' | 'l'", default: "'m'", description: 'Control size.' },
      {
        name: 'label',
        type: 'string',
        description: 'Visible label text, rendered into a real <label for>.',
      },
      {
        name: 'helper',
        type: 'string',
        description: 'Description below the control, linked via aria-describedby.',
      },
      {
        name: 'error',
        type: 'string',
        description: 'Error message; announced + referenced only when invalid.',
      },
      { name: 'value', type: 'string', description: 'Controlled value — the consumer owns it.' },
      {
        name: 'default-value',
        type: 'string',
        description: 'Uncontrolled initial value, read once by the machine at init.',
      },
      { name: 'min', type: 'number', default: 'MIN_SAFE_INTEGER', description: 'Minimum value.' },
      { name: 'max', type: 'number', default: 'MAX_SAFE_INTEGER', description: 'Maximum value.' },
      {
        name: 'step',
        type: 'number',
        default: '1',
        description: 'Amount the +/- and Arrow keys move by.',
      },
      {
        name: 'allow-mouse-wheel',
        type: 'boolean',
        default: 'false',
        description: 'Allow the mouse wheel to change the value while focused.',
      },
      {
        name: 'required',
        type: 'boolean',
        default: 'false',
        description: 'Sets aria-required and the native required.',
      },
      {
        name: 'invalid',
        type: 'boolean',
        default: 'false',
        description: 'Drives aria-invalid / aria-errormessage and danger styling.',
      },
      {
        name: 'readonly',
        type: 'boolean',
        default: 'false',
        description: 'Reads its value but cannot be changed.',
      },
      {
        name: 'disabled',
        type: 'boolean',
        default: 'false',
        description: 'Non-interactive and dimmed.',
      },
      { name: 'name', type: 'string', description: 'Native form field name.' },
    ],
    events: [
      {
        name: 'value-change',
        description:
          'CustomEvent<ValueChangeDetails> fired when the machine changes the value. The machine is the source of truth.',
      },
      {
        name: 'value-commit',
        description:
          'CustomEvent<ValueChangeDetails> fired when the value is committed (blur or Enter).',
      },
    ],
    slots: [],
  },
};
