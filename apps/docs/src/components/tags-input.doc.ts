/*
 * `lab-tags-input` documentation config — a MACHINE-DRIVEN tokenized text field: a text
 * input plus a row of removable tag chips. Enter adds a tag, Backspace removes the last,
 * each chip has a delete button and (optionally) edit-in-place, paste splits on a
 * delimiter, with a max-tags cap. It REUSES the shared form-field a11y seam (label /
 * helper / error association) on the input, exactly as Input / Combobox do.
 *
 * The matrix and live example render REAL `<lab-tags-input>` elements: typing in any cell
 * genuinely runs the @zag-js/tags-input machine — Enter adds a chip, Backspace removes the
 * last, each chip's × removes it, navigation highlights chips — nothing faked. The default
 * specimens seed a couple of chips so the chip row is visible at rest.
 */
import '@labpics/ui-core/tags-input';
import type { ComponentDoc } from '../template/component-doc.js';

/** Build a real `<lab-tags-input>` with the given attribute map applied, seeded with two
 * default chips so the chip row reads at rest. */
function makeTagsInput(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const el = document.createElement('lab-tags-input');
  el.setAttribute('label', 'Tags');
  el.setAttribute('placeholder', 'Add a tag…');
  el.setAttribute('default-value', JSON.stringify(['design', 'system']));
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

export const tagsInputDoc: ComponentDoc = {
  slug: 'tags-input',
  order: 15,
  tag: 'lab-tags-input',
  title: 'Tags Input',
  summary:
    "A tokenized text field — a text input plus a row of removable tag chips. Runs the @zag-js/tags-input machine through the LabUI seam: the machine owns the tag array, the input value, add-on-Enter, Backspace-removes-the-last, the highlighted-tag navigation (Arrow/Home/End), each chip's delete trigger + its accessible name, edit-in-place (Enter / double-click), paste-split on the delimiter, and the max-tags / overflow validity. It REUSES the shared field-a11y helper for the label / helper / error association — the same seam as Input — on the text input (the field's control). The element only paints with semantic --lab-* roles.",
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
    make: makeTagsInput,
  },

  anatomy: [
    {
      index: 1,
      name: 'Label',
      description:
        'A real <label for> naming the text input — the field-a11y seam (shared with Input). Its id is the machine label part, and htmlFor targets the input id, so the field has an accessible name.',
    },
    {
      index: 2,
      name: 'Control',
      description:
        'The Zag control — a bordered box that wraps the chip row and the text input. The machine spreads data attributes on it; the field surface (border / focus ring / sentiment) is reused from the shared field-styles.',
    },
    {
      index: 3,
      name: 'Tag chip (item)',
      description:
        'One tag — a pill keyed by data-value (NOT index; tags reorder/remove). The machine sets data-highlighted on the navigated chip and wires its parts. It holds a preview (the text + a delete button) and a hidden edit-in-place input.',
    },
    {
      index: 4,
      name: 'Delete trigger',
      description:
        'The chip\'s × button — a real <button> the machine wires with an accessible name ("Delete <tag>", from the shared translations) and the remove keyboard/click.',
    },
    {
      index: 5,
      name: 'Edit input',
      description:
        'A per-chip <input> the machine reveals (drops its hidden attribute) when the chip is edited (Enter / double-click), to rename the tag in place. Hidden otherwise.',
    },
    {
      index: 6,
      name: 'Input',
      description:
        "The text-entry <input> — the field's control. The machine owns its value and the keyboard (Enter adds, Backspace removes the last). The shared field-a11y helper adds aria-describedby (helper + error) / aria-invalid / aria-errormessage / aria-required on top — merged, not overwritten.",
    },
    {
      index: 7,
      name: 'Helper / Error',
      description:
        'Description text below the control (linked via aria-describedby) and, when invalid + a message exists, an error region announced via role="alert" and linked via aria-errormessage — the field-a11y seam, identical on both renderers.',
    },
  ],

  meaning: {
    purpose:
      'A tags input lets a user build a SET of short string values — labels, keywords, recipients, categories — by typing each one and committing it (Enter or the delimiter) into a removable chip. It shows the accumulated set inline and lets the user remove any chip or edit it in place. Use it when the user enters several free-form values that should each become a discrete, removable token. It is NOT a Combobox (no listbox of pre-defined options to pick from) and NOT a Select (free text, not a closed list).',
    dos: [
      'Use when the user enters a set of short free-form values that each become a removable token.',
      'Set max to cap the number of tags; an add past the cap is rejected and fires value-invalid (reason rangeOverflow).',
      'Set delimiter (default ",") to control what commits a tag and what splits a paste; set addOnPaste to split a pasted value into tags.',
      'Let the machine own add / remove / edit / navigation — never hand-roll tag-add or the chip keyboard.',
    ],
    donts: [
      "Don't use it to pick from a fixed list of options — that's a Combobox or a Select.",
      "Don't hand-roll Enter-adds / Backspace-removes with keydown handlers; the machine owns them.",
      "Don't key chips by index — tags reorder/remove every edit; the machine and the element key by value.",
      "Don't duplicate the label/helper/error a11y — reuse the shared field-a11y seam, exactly as Input does.",
    ],
  },

  liveExample: {
    make: () => makeTagsInput({ size: 'm', helper: 'Press Enter or comma to add a tag.' }),
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
      { kind: 'toggle', label: 'Add on paste', attribute: 'add-on-paste' },
      { kind: 'toggle', label: 'Disabled', attribute: 'disabled' },
      { kind: 'toggle', label: 'Read only', attribute: 'readonly' },
      { kind: 'toggle', label: 'Invalid', attribute: 'invalid' },
    ],
  },

  api: {
    props: [
      {
        name: 'max',
        type: 'number',
        default: 'Infinity',
        description:
          'Maximum number of tags. At the cap, the next add is rejected and value-invalid fires (reason rangeOverflow).',
      },
      {
        name: 'delimiter',
        type: 'string',
        default: "','",
        description: 'The character that adds a tag and splits a pasted value into tags.',
      },
      {
        name: 'editable',
        type: 'boolean',
        default: 'true',
        description: 'Allow editing a chip in place (Enter or double-click on the chip).',
      },
      {
        name: 'addOnPaste',
        type: 'boolean',
        default: 'false',
        description: 'Add tags when a value is pasted (split on the delimiter).',
      },
      {
        name: 'allowDuplicates',
        type: 'boolean',
        default: 'false',
        description: 'Allow the same tag value more than once.',
      },
      {
        name: 'type',
        type: "'neutral' | 'danger' | 'warning' | 'success'",
        default: "'neutral'",
        description: 'Field sentiment — drives the control border / focus ring (the field axis).',
      },
      {
        name: 'size',
        type: "'s' | 'm' | 'l'",
        default: "'m'",
        description: 'Control size — drives the control padding and font.',
      },
      {
        name: 'value',
        type: 'string[]',
        description:
          'Controlled tag value(s). A JS property; a JSON array or comma-separated attribute is parsed for HTML/SSR.',
      },
      {
        name: 'defaultValue',
        type: 'string[]',
        description: 'Uncontrolled initial tag value(s) — read once by the machine at init.',
      },
      {
        name: 'disabled / readonly / required / invalid',
        type: 'boolean',
        default: 'false',
        description:
          'The field states. disabled/readonly gate interaction; required/invalid drive the field a11y (aria-required / aria-invalid / aria-errormessage) and the sentiment styling.',
      },
      {
        name: 'name',
        type: 'string',
        description: 'Field name (rides the hidden input) for form submission.',
      },
      { name: 'label', type: 'string', description: 'Visible label text (accessible name).' },
      { name: 'placeholder', type: 'string', description: 'Shown in the input when empty.' },
      {
        name: 'helper / error',
        type: 'string',
        description:
          'Description text below the control (linked via aria-describedby) and an error message announced + linked only when invalid — the shared field-a11y seam.',
      },
    ],
    events: [
      {
        name: 'value-change',
        description:
          'CustomEvent<ValueChangeDetails> fired when the tag value(s) update (add / remove / edit). The machine is the source of truth.',
      },
      {
        name: 'input-value-change',
        description:
          'CustomEvent<InputValueChangeDetails> fired when the typed input value changes.',
      },
      {
        name: 'value-invalid',
        description:
          'CustomEvent<ValidityChangeDetails> fired when a tag fails validation (reason "invalidTag"), or the tag count overflows the max (reason "rangeOverflow", only when overflow is permitted).',
      },
    ],
    slots: [],
  },
};
