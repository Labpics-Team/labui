/*
 * `lab-pin-input` documentation config — a MACHINE-DRIVEN segmented code field: N
 * single-character `<input>`s that focus-advance on type, fill across on paste, and
 * optionally mask. It REUSES the shared form-field a11y seam (label / helper / error
 * association), lifted to the control GROUP because a pin input has N boxes and one shared
 * description. Required state belongs to the visible textbox segments, not the group.
 *
 * The matrix and live example render REAL `<lab-pin-input>` elements: focusing any cell
 * genuinely runs the @zag-js/pin-input machine — typing advances the focus to the next
 * box, Backspace steps back, paste distributes across the boxes — nothing faked. The live
 * controls re-point the same axes the machine reads.
 */
import '@labpics/ui-core/pin-input';
import type { ComponentDoc } from '../template/component-doc.js';

/** Build a real `<lab-pin-input>` with the given attribute map applied. */
function makePinInput(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const el = document.createElement('lab-pin-input');
  el.setAttribute('label', 'Verification code');
  el.setAttribute('count', '4');
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

export const pinInputDoc: ComponentDoc = {
  slug: 'pin-input',
  order: 14,
  tag: 'lab-pin-input',
  title: 'Pin Input',
  summary:
    "A segmented code field — N single-character inputs that focus-advance as you type, fill across on paste, and optionally mask. Runs the @zag-js/pin-input machine through the LabUI seam: the machine owns each box's value, the roving focus that auto-advances on type and steps back on Backspace, the paste-fill that distributes across the boxes, masking (type=password), the roving tabindex + per-box aria-invalid, and the complete/invalid lifecycle. It REUSES the shared field-a11y helper for the label / helper / error association — the same seam as Input — lifted to the control group (role=group + aria-labelledby + describedby), so the ARIA contract is one source of truth across both renderers. The element only paints with semantic --lab-* roles.",
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
    make: makePinInput,
  },

  anatomy: [
    {
      index: 1,
      name: 'Label',
      description:
        'A real <label> naming the field — the field-a11y seam (shared with Input). The machine targets the hidden form input; the control group is labelled by this label id (aria-labelledby), so the segmented control has an accessible name.',
    },
    {
      index: 2,
      name: 'Control (group)',
      description:
        'The Zag control — a role="group" track of segments. The shared field-a11y helper adds aria-labelledby → label and aria-describedby (helper + error) / aria-invalid / aria-errormessage. aria-required is intentionally absent because role="group" does not support it.',
    },
    {
      index: 3,
      name: 'Segment',
      description:
        'One single-character <input>, keyed by data-index. The machine spreads the value, the roving tabindex (0 on the active box, -1 on the rest), per-box aria-invalid, inputmode, and type=password when masked. When the field is required, each visible textbox segment carries aria-required=true. THIS is the painted field surface (border / focus ring / sentiment) — reused from the shared field-styles.',
    },
    {
      index: 4,
      name: 'Hidden input',
      description:
        'Машина записывает объединённое значение в визуально скрытый input. В React он участвует в отправке и нативной проверке формы. У Lit input находится в shadow DOM, а элемент пока не связан с формой: отправку значения и проверку нужно связать явно.',
    },
    {
      index: 5,
      name: 'Helper / Error',
      description:
        'Description text below the control (linked via the group aria-describedby) and, when invalid + a message exists, an error region announced via role="alert" and linked via aria-errormessage — the field-a11y seam, identical on both renderers.',
    },
  ],

  meaning: {
    purpose:
      'A pin input collects a short, fixed-length code one character at a time across separate boxes — a verification / OTP / PIN entry. The separate boxes make the expected length obvious and let the user see each character land. The machine auto-advances focus on type, steps back on Backspace, and distributes a paste across the boxes, so a pasted code fills correctly. Use it for codes; it is NOT a general text field (use Input) and NOT a numeric value (use Number Input).',
    dos: [
      'Use for a fixed-length code: verification / OTP / PIN. Set count to the code length.',
      'Set valueType to numeric for a digit-only code (the default), alphanumeric or alphabetic otherwise.',
      'Set mask to hide the characters for a secret PIN; set otp for one-time-code autofill.',
      'Let the machine own the focus dance and paste-fill — never hand-roll focus-advance.',
    ],
    donts: [
      "Don't use it for free text or a value with no fixed length — that's an Input.",
      "Don't hand-roll focus-advance or paste-distribution with keydown handlers; the machine owns them.",
      "Don't put aria-required on the group — role=group does not support it; required belongs to the textbox segments.",
      "Don't key the boxes by anything but their index — that IS the machine's stable per-box key.",
    ],
  },

  liveExample: {
    make: () => makePinInput({ size: 'm', helper: 'Enter the 4-digit code we sent you.' }),
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
      {
        kind: 'select',
        label: 'Value type',
        attribute: 'value-type',
        options: [
          { label: 'Numeric', value: 'numeric' },
          { label: 'Alphanumeric', value: 'alphanumeric' },
          { label: 'Alphabetic', value: 'alphabetic' },
        ],
      },
      { kind: 'toggle', label: 'Mask', attribute: 'mask' },
      { kind: 'toggle', label: 'Disabled', attribute: 'disabled' },
      { kind: 'toggle', label: 'Invalid', attribute: 'invalid' },
    ],
  },

  api: {
    props: [
      {
        name: 'count',
        type: 'number',
        default: '4',
        description: 'The number of single-character segments to render.',
      },
      {
        name: 'valueType',
        type: "'numeric' | 'alphanumeric' | 'alphabetic'",
        default: "'numeric'",
        description:
          'The character set each segment accepts (the machine type). Named valueType so it never collides with the sentiment type axis.',
      },
      {
        name: 'mask',
        type: 'boolean',
        default: 'false',
        description: 'Hide each character — the boxes render as type=password.',
      },
      {
        name: 'otp',
        type: 'boolean',
        default: 'false',
        description:
          'Signal one-time-code autofill (autocomplete="one-time-code") on the segments.',
      },
      {
        name: 'type',
        type: "'neutral' | 'danger' | 'warning' | 'success'",
        default: "'neutral'",
        description: 'Field sentiment — drives each segment border / focus ring (the field axis).',
      },
      {
        name: 'size',
        type: "'s' | 'm' | 'l'",
        default: "'m'",
        description: 'Control size — drives the segment box size and font.',
      },
      {
        name: 'placeholder',
        type: 'string',
        default: "'○'",
        description: 'The placeholder character shown in each empty box.',
      },
      {
        name: 'value',
        type: 'string[]',
        description:
          'Controlled value (array of single chars). A JS property; a JSON array or bare string attribute is parsed for HTML/SSR.',
      },
      {
        name: 'defaultValue',
        type: 'string[]',
        description: 'Uncontrolled initial value — read once by the machine at init.',
      },
      {
        name: 'disabled / readonly / required / invalid',
        type: 'boolean',
        default: 'false',
        description:
          'Состояния поля: disabled/readonly ограничивают взаимодействие, invalid задаёт ошибку группы, required ставит aria-required на каждом видимом сегменте и required на скрытом input машины. Для Lit это не включает нативную проверку формы.',
      },
      {
        name: 'name',
        type: 'string',
        description:
          'Имя скрытого input машины. В React оно попадает в FormData; Lit-элемент пока не связан с нативной формой.',
      },
      {
        name: 'label',
        type: 'string',
        description: 'Visible label text (accessible name of the group).',
      },
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
          'CustomEvent<ValueChangeDetails> fired on every input change (detail.value is the array, detail.valueAsString the joined string). The machine is the source of truth.',
      },
      {
        name: 'value-complete',
        description: 'CustomEvent<ValueChangeDetails> fired when all segments are filled.',
      },
      {
        name: 'value-invalid',
        description:
          'CustomEvent<ValueInvalidDetails> fired when an invalid character is entered or pasted.',
      },
    ],
    slots: [],
  },
};
