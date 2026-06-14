/*
 * `lab-input` documentation config — a PRESENTATIONAL form field that opts out of
 * the Behaviors seam (no text-input machine in @zag-js) but OWNS the form-field
 * a11y wiring: a real <label for>, an optional helper linked via aria-describedby,
 * and an error announced (role="alert") + referenced (aria-errormessage) only when
 * the field is invalid. The wiring is the shared `field-a11y` helper, identical on
 * the Lit element and the React twin — so the matrix below documents real ARIA, not
 * a faked role.
 */
import '@labpics/ui-core/input';
import type { ComponentDoc } from '../template/component-doc.js';

/** Build a real `<lab-input>` with the given attribute map applied. */
function makeInput(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const el = document.createElement('lab-input');
  el.setAttribute('label', 'Email');
  el.setAttribute('placeholder', 'you@example.com');
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

export const inputDoc: ComponentDoc = {
  slug: 'input',
  order: 9,
  tag: 'lab-input',
  title: 'Input',
  summary:
    'A single-line text field: a native <input> wired to a label, an optional helper, and an optional error via genuine ARIA. Presentational (no machine — the native control owns value/caret/editing); it owns the form-field a11y wiring, computed by the shared field-a11y helper identically on Lit and React.',
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
    make: makeInput,
  },

  anatomy: [
    {
      index: 1,
      name: 'Label',
      description:
        'A real <label for> bound to the control id (the strongest label association). Reads --lab-label-secondary; a required field appends a danger-coloured mark.',
    },
    {
      index: 2,
      name: 'Control (input)',
      description:
        'The native <input>. Resting border is --lab-border-base; hover is --lab-border-strong; the sentiment type re-points it to --lab-border-{danger|warning|success}. Text is --lab-label-primary over --lab-bg-primary; the placeholder is --lab-label-tertiary.',
    },
    {
      index: 3,
      name: 'Helper',
      description:
        'Optional description below the control, --lab-label-tertiary. Linked to the control via aria-describedby so a screen reader announces it with the field.',
    },
    {
      index: 4,
      name: 'Error + focus ring',
      description:
        'When invalid with a message, an error (role="alert", --lab-label-danger) is announced and referenced via aria-invalid + aria-errormessage, and added to aria-describedby. The :focus-visible ring reads --lab-border-focus (or the sentiment colour).',
    },
  ],

  meaning: {
    purpose:
      'An input collects a single line of free text inside a form submitted later. It owns the programmatic association of its label, helper, and error to the native control — the part the platform does not give for free — so the field is accessible by construction, not by a bolted-on role.',
    dos: [
      'Always pass a label; use label-hidden only when an adjacent visual label is impossible, never to drop the a11y name.',
      'Set invalid together with an error message — the error is announced and referenced only when both are present.',
      'Use the sentiment type (danger / warning / success) to signal validation state, paired with a real message, not colour alone.',
    ],
    donts: [
      "Don't fabricate ARIA the native input already provides — value, editing, and required come from the control.",
      "Don't set invalid with no error message; an empty error region is never referenced (it would point a reader at nothing).",
      "Don't hardcode colours against it — it only ever reads --lab-* roles bound by an ancestor.",
    ],
  },

  liveExample: {
    make: () => makeInput({ helper: 'We never share your address.' }),
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
        name: 'label-hidden',
        type: 'boolean',
        default: 'false',
        description: 'Visually hide the label while keeping it in the a11y tree.',
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
      {
        name: 'input-type',
        type: 'string',
        default: "'text'",
        description: 'Native input type (text | email | password | …).',
      },
      { name: 'value', type: 'string', default: "''", description: 'Current value.' },
      { name: 'placeholder', type: 'string', description: 'Placeholder for the empty control.' },
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
        name: 'lab-input',
        description: 'CustomEvent<{ value: string }> fired on every edit (native input event).',
      },
      {
        name: 'lab-change',
        description: 'CustomEvent<{ value: string }> fired on commit (native change event).',
      },
    ],
    slots: [],
  },
};
