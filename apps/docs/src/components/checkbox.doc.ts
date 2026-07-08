/*
 * `lab-checkbox` documentation config — a production component CONSUMING the
 * @zag-js/checkbox machine through the Behaviors seam, with the HONEST tri-state.
 *
 * The `indeterminate` (mixed) state is a REAL machine value (aria-checked="mixed"),
 * not a faked glyph: the matrix and the live control set the reflected
 * `indeterminate` attribute, which the machine reads to carry the true
 * "indeterminate" CheckedState. Clicking a mixed checkbox runs the machine, which
 * resolves it to a concrete checked value — exactly as a real tri-state should.
 */
import '@labpics/ui-core/checkbox';
import type { ComponentDoc } from '../template/component-doc.js';

/** Build a real `<lab-checkbox>` with the given attribute map applied. */
function makeCheckbox(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const el = document.createElement('lab-checkbox');
  el.textContent = 'Accept terms';
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

export const checkboxDoc: ComponentDoc = {
  slug: 'checkbox',
  order: 7,
  tag: 'lab-checkbox',
  title: 'Checkbox',
  summary:
    'A tri-state selection control: checked, unchecked, or the honest indeterminate (mixed) state. Runs the @zag-js/checkbox machine through the LabUI seam: the machine owns checked/indeterminate, keyboard, focus and aria-checked (including "mixed").',
  status: { kind: 'stable' },

  statesMatrix: {
    axes: [
      {
        name: 'State',
        // Three honest options: unchecked, checked, and the machine's real mixed
        // value (mapped to the `indeterminate` reflected attribute by `make`).
        attribute: 'checked',
        options: [
          { label: 'Unchecked', value: false },
          { label: 'Checked', value: true },
          { label: 'Mixed', value: 'mixed' },
        ],
      },
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
          { label: 'Tiny', value: 'tiny' },
          { label: 'S', value: 's' },
          { label: 'M', value: 'm' },
          { label: 'L', value: 'l' },
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
    // The State axis emits the string "mixed" for the indeterminate column; the
    // element exposes that honest third state via the `indeterminate` attribute.
    make: (attrs) => {
      const resolved: Record<string, string | boolean> = {};
      for (const [key, value] of Object.entries(attrs)) {
        if (key === 'checked' && value === 'mixed') {
          resolved.indeterminate = true;
        } else {
          resolved[key] = value;
        }
      }
      return makeCheckbox(resolved);
    },
  },

  anatomy: [
    {
      index: 1,
      name: 'Root (label)',
      description:
        'The Zag root element — a <label> wrapping the box and text, so clicking either toggles the machine. Reads --lab-label-primary for the label text.',
    },
    {
      index: 2,
      name: 'Box (control)',
      description:
        'The Zag control element. Unchecked is a transparent box bordered with --lab-border-base; checked OR mixed fills with --lab-fill-accent / -neutral / -danger by type.',
    },
    {
      index: 3,
      name: 'Glyphs',
      description:
        'Two mutually exclusive SVG marks coloured by --lab-label-on-*: a check (fully checked) and a dash (mixed). The machine’s state decides which shows — the dash is the honest indeterminate render, not a faked tick.',
    },
    {
      index: 4,
      name: 'Hidden input + focus ring',
      description:
        'The Zag hidden input keeps the box in the form + a11y tree, and the machine sets its .indeterminate DOM property. Focus delegates to it; a :focus-visible ring from --lab-border-focus shows on the box.',
    },
  ],

  meaning: {
    purpose:
      'A checkbox selects an item or stages a boolean choice, typically inside a form submitted later. Its third state — indeterminate (mixed) — is a REAL machine value, not a visual trick: use it for a parent checkbox whose children are partly selected. Clicking a mixed box runs the machine, which resolves it to a concrete checked value.',
    dos: [
      'Use for multi-select lists and staged form choices that a Save action commits.',
      'Use the honest indeterminate state for a parent that summarises a partial child selection.',
      'Let the machine own the tri-state — read checked-change, never re-implement aria-checked="mixed".',
    ],
    donts: [
      "Don't use it for an immediate, self-applying setting — that is a Switch.",
      'Don\'t fake the mixed state with a half-opacity tick; the machine carries a real "indeterminate" value.',
      "Don't hardcode colours against it — it only ever reads --lab-* roles bound by an ancestor.",
    ],
  },

  liveExample: {
    make: () => makeCheckbox({ checked: true }),
    // Honest live controls. `checked`, `indeterminate`, `disabled` and `size` are
    // all reflected attributes the machine reads on update. The `indeterminate`
    // toggle drives the REAL third state (aria-checked="mixed"); clicking the box
    // runs the machine, which resolves mixed → checked, exactly as it should.
    controls: [
      { kind: 'toggle', label: 'Checked', attribute: 'checked' },
      { kind: 'toggle', label: 'Indeterminate (mixed)', attribute: 'indeterminate' },
      { kind: 'toggle', label: 'Disabled', attribute: 'disabled' },
      {
        kind: 'select',
        label: 'Size',
        attribute: 'size',
        options: [
          { label: 'Tiny', value: 'tiny' },
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
        type: "'accent' | 'neutral' | 'danger'",
        default: "'accent'",
        description: 'Semantic intent of the checked / mixed box fill.',
      },
      {
        name: 'size',
        type: "'tiny' | 's' | 'm' | 'l'",
        default: "'m'",
        description: 'Control size.',
      },
      {
        name: 'checked',
        type: 'boolean',
        default: 'false',
        description: 'Controlled checked state. Reflected for CSS + SSR.',
      },
      {
        name: 'indeterminate',
        type: 'boolean',
        default: 'false',
        description:
          'The honest third state. When set, the machine carries "indeterminate" and aria-checked is "mixed". Reflected for styling and SSR.',
      },
      {
        name: 'default-checked',
        type: 'boolean',
        default: 'false',
        description: 'Uncontrolled initial checked state — read once by the machine at init.',
      },
      {
        name: 'default-indeterminate',
        type: 'boolean',
        default: 'false',
        description: 'Uncontrolled initial indeterminate state — read once at init.',
      },
      {
        name: 'disabled',
        type: 'boolean',
        default: 'false',
        description: 'Whether the checkbox is non-interactive. Reflected for styling and a11y.',
      },
    ],
    events: [
      {
        name: 'checked-change',
        description:
          'CustomEvent<{ checked: boolean | "indeterminate" }> fired when the Zag machine changes the tri-state value. The machine is the source of truth.',
      },
    ],
    slots: [{ name: '(default)', description: 'The label text projected next to the box.' }],
  },
};
