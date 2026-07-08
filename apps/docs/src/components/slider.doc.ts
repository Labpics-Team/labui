/*
 * `lab-slider` documentation config — a MACHINE-DRIVEN value slider. It runs the
 * @zag-js/slider machine through the LabUI seam (the machine owns the value, min/max/
 * step, each thumb's role="slider" + aria-valuenow/valuemin/valuemax/valuetext,
 * Arrow/Home/End/PageUp-Down keyboard stepping, pointer drag + track-click, multi-thumb
 * collision, and a hidden input per thumb) AND reuses the SAME shared `field-a11y`
 * helper for the group label / helper / error association — so the matrix below
 * documents real ARIA, not a faked role.
 */
import '@labpics/ui-core/slider';
import type { ComponentDoc } from '../template/component-doc.js';

/** Build a real `<lab-slider>` with the given attribute map applied. */
function makeSlider(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const el = document.createElement('lab-slider');
  el.setAttribute('label', 'Volume');
  el.setAttribute('default-value', '40');
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

export const sliderDoc: ComponentDoc = {
  slug: 'slider',
  order: 9,
  tag: 'lab-slider',
  title: 'Slider',
  summary:
    'A value slider: a track with a filled range and one or more draggable thumbs. Runs the @zag-js/slider machine through the LabUI seam (the machine owns the value, min/max/step, each thumb\'s role="slider" + aria-valuenow/valuemin/valuemax/valuetext, Arrow/Home/End/PageUp-Down keyboard stepping, pointer drag + track-click, multi-thumb collision, and a hidden input per thumb) and reuses the shared field-a11y helper for the group label/helper/error association.',
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
        name: 'Orientation',
        attribute: 'orientation',
        options: [
          { label: 'Horizontal', value: 'horizontal' },
          { label: 'Vertical', value: 'vertical' },
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
    make: makeSlider,
  },

  anatomy: [
    {
      index: 1,
      name: 'Label',
      description:
        "The group label — the Zag label part. The machine spreads htmlFor → the first thumb's hidden input, and each thumb's aria-labelledby → this label id, so the slider has an accessible name. The field-a11y helper adds aria-describedby → helper/error here.",
    },
    {
      index: 2,
      name: 'Value text',
      description:
        'An optional live readout (show-value) — the Zag valueText part, --lab-label-primary, tabular-nums so the number does not jitter as it changes.',
    },
    {
      index: 3,
      name: 'Track',
      description:
        'The Zag track — the full rail the value runs along, --lab-fill-primary. The control reserves room around it so the thumb never clips at the ends.',
    },
    {
      index: 4,
      name: 'Range',
      description:
        'The filled portion from the origin to the thumb — the Zag range part, --lab-fill-accent (--lab-fill-danger when invalid). The machine writes its inset, so it always matches the value.',
    },
    {
      index: 5,
      name: 'Thumb',
      description:
        'The draggable handle — the Zag thumb, role="slider" with aria-valuenow/valuemin/valuemax/valuetext/orientation. --lab-control-bg with a --lab-border-base ring; the focus ring is --lab-border-focus. A range slider renders one thumb per value, keyed by index.',
    },
    {
      index: 6,
      name: 'Markers',
      description:
        'Optional value markers along the track — the Zag marker-group + marker parts, keyed by value, --lab-border-strong.',
    },
  ],

  meaning: {
    purpose:
      'A slider lets a user pick a value (or a range, with two thumbs) from a continuous span by dragging a thumb or stepping with the keyboard. The machine owns the value, the slider/thumb ARIA, keyboard stepping, drag and collision; the field owns the group label/helper/error association. Use it for a continuous, directly-manipulated value (volume, brightness, a price range) — not for a precise typed number (use Number Input) and not for a closed list (use Select).',
    dos: [
      'Give it a label so each thumb gets an accessible name (the machine wires aria-labelledby → the label).',
      'Set min, max and step to bound the value; pass an array value with two entries for a range.',
      'Let the machine own keyboard stepping (Arrow/Home/End/PageUp-Down), drag and collision — never re-implement them.',
    ],
    donts: [
      "Don't hand-roll roving focus or aria-valuenow — the machine owns the thumb role + value ARIA.",
      "Don't use it for a precise typed number; that is a Number Input.",
      "Don't key thumbs by anything but their index — the machine keys its per-thumb getters by index.",
    ],
  },

  liveExample: {
    make: () => makeSlider({ helper: 'Drag or use the arrow keys.', 'show-value': true }),
    controls: [
      { kind: 'toggle', label: 'Show value', attribute: 'show-value' },
      { kind: 'toggle', label: 'Invalid', attribute: 'invalid' },
      { kind: 'toggle', label: 'Disabled', attribute: 'disabled' },
      { kind: 'toggle', label: 'Read-only', attribute: 'readonly' },
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
        label: 'Orientation',
        attribute: 'orientation',
        options: [
          { label: 'Horizontal', value: 'horizontal' },
          { label: 'Vertical', value: 'vertical' },
        ],
      },
    ],
  },

  api: {
    props: [
      { name: 'size', type: "'s' | 'm' | 'l'", default: "'m'", description: 'Control size.' },
      {
        name: 'orientation',
        type: "'horizontal' | 'vertical'",
        default: "'horizontal'",
        description: 'Slider orientation.',
      },
      {
        name: 'label',
        type: 'string',
        description: 'Group label — the thumbs’ accessible name (aria-labelledby).',
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
        name: 'value',
        type: 'number[]',
        description:
          'Controlled value(s) — a JS property; a JSON / comma attribute is parsed for HTML/SSR. Two entries make a range.',
      },
      {
        name: 'default-value',
        type: 'number[]',
        default: '[50]',
        description: 'Uncontrolled initial value(s), read once by the machine at init.',
      },
      { name: 'min', type: 'number', default: '0', description: 'Minimum value.' },
      { name: 'max', type: 'number', default: '100', description: 'Maximum value.' },
      {
        name: 'step',
        type: 'number',
        default: '1',
        description: 'Amount the drag and Arrow keys move by.',
      },
      {
        name: 'marks',
        type: 'number[]',
        description: 'Value markers along the track (JSON / comma attribute or property).',
      },
      {
        name: 'show-value',
        type: 'boolean',
        default: 'false',
        description: 'Show the live value readout above the control.',
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
      {
        name: 'name',
        type: 'string',
        description: 'Native form field name for the hidden input(s).',
      },
    ],
    events: [
      {
        name: 'value-change',
        description:
          'CustomEvent<ValueChangeDetails> fired as the machine changes the value. The machine is the source of truth.',
      },
      {
        name: 'value-change-end',
        description:
          'CustomEvent<ValueChangeDetails> fired when a change gesture ends (drag release / key commit).',
      },
    ],
    slots: [],
  },
};
