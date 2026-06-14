/*
 * `lab-textarea` documentation config — a PRESENTATIONAL multi-line form field. It
 * shares Input's form-field a11y wiring (the same shared `field-a11y` helper: a real
 * <label for>, helper via aria-describedby, error via aria-invalid + aria-errormessage
 * + role="alert" only when invalid) and adds the multi-line extras: rows and an
 * honest auto-resize (a height that tracks scrollHeight — local view state, not a
 * machine).
 */
import '@labpics/ui-core/textarea';
import type { ComponentDoc } from '../template/component-doc.js';

/** Build a real `<lab-textarea>` with the given attribute map applied. */
function makeTextarea(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const el = document.createElement('lab-textarea');
  el.setAttribute('label', 'Bio');
  el.setAttribute('placeholder', 'Tell us about yourself');
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

export const textareaDoc: ComponentDoc = {
  slug: 'textarea',
  order: 10,
  tag: 'lab-textarea',
  title: 'Textarea',
  summary:
    'A multi-line text field: a native <textarea> wired to a label, an optional helper, and an optional error via the same genuine ARIA as Input, plus rows and an optional honest auto-resize. Presentational (no machine — the native control owns value/caret/editing); the a11y wiring is the shared field-a11y helper, identical on Lit and React.',
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
    make: makeTextarea,
  },

  anatomy: [
    {
      index: 1,
      name: 'Label',
      description:
        'A real <label for> bound to the control id. Reads --lab-label-secondary; a required field appends a danger-coloured mark.',
    },
    {
      index: 2,
      name: 'Control (textarea)',
      description:
        'The native <textarea>, vertically resizable by default. Resting border --lab-border-base; hover --lab-border-strong; sentiment re-points to --lab-border-{danger|warning|success}. Text --lab-label-primary over --lab-bg-primary; placeholder --lab-label-tertiary.',
    },
    {
      index: 3,
      name: 'Helper',
      description:
        'Optional description below the control, --lab-label-tertiary, linked via aria-describedby so a screen reader announces it with the field.',
    },
    {
      index: 4,
      name: 'Error + focus ring',
      description:
        'When invalid with a message, an error (role="alert", --lab-label-danger) is announced and referenced via aria-invalid + aria-errormessage. The :focus-visible ring reads --lab-border-focus (or the sentiment colour). Auto-resize grows the control to fit content (local view state).',
    },
  ],

  meaning: {
    purpose:
      'A textarea collects multiple lines of free text inside a form. It shares Input’s a11y contract and adds rows + an honest auto-resize that tracks scrollHeight — a height computed from content, never a faked machine.',
    dos: [
      'Always pass a label; use label-hidden only when an adjacent visual label is impossible.',
      'Set invalid together with an error message — the error is announced and referenced only when both are present.',
      'Use auto-resize for free-form notes where the content length varies; keep rows as a sensible initial height.',
    ],
    donts: [
      "Don't fabricate ARIA the native textarea already provides — value, editing, and required come from the control.",
      "Don't set invalid with no error message; an empty error region is never referenced.",
      "Don't hardcode colours against it — it only ever reads --lab-* roles bound by an ancestor.",
    ],
  },

  liveExample: {
    make: () => makeTextarea({ helper: 'Markdown is supported.' }),
    controls: [
      { kind: 'toggle', label: 'Required', attribute: 'required' },
      { kind: 'toggle', label: 'Invalid', attribute: 'invalid' },
      { kind: 'toggle', label: 'Disabled', attribute: 'disabled' },
      { kind: 'toggle', label: 'Read-only', attribute: 'readonly' },
      { kind: 'toggle', label: 'Auto-resize', attribute: 'auto-resize' },
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
      { name: 'value', type: 'string', default: "''", description: 'Current value.' },
      { name: 'placeholder', type: 'string', description: 'Placeholder for the empty control.' },
      { name: 'rows', type: 'number', default: '3', description: 'Initial visible text rows.' },
      {
        name: 'auto-resize',
        type: 'boolean',
        default: 'false',
        description: 'Grow the control to fit its content (local view state, tracks scrollHeight).',
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
