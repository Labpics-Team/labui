/*
 * `lab-tooltip` documentation config — the FIRST positioned-overlay page, the
 * reference every later overlay (Popover, Menu, Select, Dialog) follows.
 *
 * The states matrix and live example render REAL `<lab-tooltip>` elements. A
 * tooltip's surface is hidden until the machine opens it on hover/focus, so the
 * grid shows the live TRIGGERS across placement and size; hovering or focusing any
 * cell genuinely opens the floating layer through the Zag machine (nothing is
 * faked, nothing is force-painted open — no misleading stop-gaps). The live
 * controls re-point the same axes the machine reads.
 */
import '@labpics/ui-core/tooltip';
import type { ComponentDoc } from '../template/component-doc.js';

/** Build a real `<lab-tooltip>` with the given attribute map applied. The default
 * slot becomes the trigger button's content; `content` is the tooltip body. */
function makeTooltip(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const el = document.createElement('lab-tooltip');
  el.textContent = 'Hover me';
  el.setAttribute('content', 'Saved to your library');
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

export const tooltipDoc: ComponentDoc = {
  slug: 'tooltip',
  order: 9,
  tag: 'lab-tooltip',
  title: 'Tooltip',
  summary:
    'A passive hint that appears on hover or focus, positioned against its trigger. Runs the @zag-js/tooltip machine through the LabUI seam: the machine owns the open lifecycle, openDelay/closeDelay, Escape-to-dismiss, role="tooltip" + aria-describedby, and dynamic positioning (Floating UI). The element only paints with semantic --lab-* roles.',
  status: { kind: 'stable' },

  statesMatrix: {
    axes: [
      {
        name: 'Placement',
        attribute: 'placement',
        options: [
          { label: 'Top', value: 'top' },
          { label: 'Right', value: 'right' },
          { label: 'Bottom', value: 'bottom' },
          { label: 'Left', value: 'left' },
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
    make: makeTooltip,
  },

  anatomy: [
    {
      index: 1,
      name: 'Trigger',
      description:
        'The Zag trigger element — a real <button> so hover, focus and keyboard land on one accessible target. The machine spreads role/aria-describedby/handlers here. It wraps the slotted label or icon; it carries no surface of its own.',
    },
    {
      index: 2,
      name: 'Positioner',
      description:
        'The Zag positioner. Floating UI writes the computed --x / --y onto it each frame and mirrors the content z-index into --z-index. It uses position:fixed so the surface escapes overflow:hidden and stacking ancestors without a portal.',
    },
    {
      index: 3,
      name: 'Content',
      description:
        'The floating surface — role="tooltip", hidden until open. Reads the inverted roles (--lab-bg-inverted + --lab-label-inverted-primary), lifted with --lab-fx-shadow-minor and layered at --lab-z-tooltip.',
    },
    {
      index: 4,
      name: 'Arrow',
      description:
        'The optional Zag arrow + tip. The tip inherits --arrow-background (the same inverted surface role), so it reads as one shape pointing at the trigger.',
    },
  ],

  meaning: {
    purpose:
      'A tooltip is a passive, supplementary hint — a label or short clarification that appears when the user hovers or focuses a control, and disappears when they leave. It never holds interactive content and never demands action: it explains, it does not ask. Use it to name an icon-only button or to expand a terse label. It is NOT a popover (which is an interactive panel opened by click) and NOT a way to hide essential information.',
    dos: [
      'Use for a short, non-interactive hint on an icon or terse control.',
      'Keep the trigger a single focusable element — the machine shows the tooltip on its focus, so keyboard users get it too.',
      'Let the machine own open/close and positioning — read open-change, never place the surface by hand.',
    ],
    donts: [
      "Don't put links, buttons or form fields inside — that is a popover's job (content-on-hover that can't be reached is an a11y failure).",
      "Don't hide information the user must have to act; a tooltip is supplementary, not load-bearing.",
      "Don't nest another interactive element in the trigger slot — the trigger already IS a button.",
    ],
  },

  liveExample: {
    make: () => makeTooltip({ placement: 'top' }),
    // Honest live controls: placement and size are reflected attributes the machine
    // reads, so changing them really re-points the floating layer; disabled really
    // blocks the machine. Hovering or focusing the trigger runs the Zag machine —
    // that is the primary interaction.
    controls: [
      {
        kind: 'select',
        label: 'Placement',
        attribute: 'placement',
        options: [
          { label: 'Top', value: 'top' },
          { label: 'Right', value: 'right' },
          { label: 'Bottom', value: 'bottom' },
          { label: 'Left', value: 'left' },
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
      { kind: 'toggle', label: 'Disabled', attribute: 'disabled' },
    ],
  },

  api: {
    props: [
      {
        name: 'placement',
        type: "Placement ('top' | 'right' | 'bottom' | 'left' (+ '-start' | '-end'))",
        default: "'bottom'",
        description: 'Where the floating layer sits relative to the trigger (Zag popper).',
      },
      {
        name: 'size',
        type: "'s' | 'm' | 'l'",
        default: "'m'",
        description: 'Control size — drives content padding, font-size and max-width.',
      },
      {
        name: 'content',
        type: 'string',
        description: 'Tooltip body text (the simple case). For rich content use slot="content".',
      },
      {
        name: 'open-delay',
        type: 'number',
        default: '400',
        description: 'Delay in ms before the tooltip opens on hover/focus.',
      },
      {
        name: 'close-delay',
        type: 'number',
        default: '150',
        description: 'Delay in ms before the tooltip closes.',
      },
      {
        name: 'disabled',
        type: 'boolean',
        default: 'false',
        description: 'When set, the machine never opens.',
      },
      {
        name: 'arrow',
        type: 'boolean',
        default: 'true',
        description: 'Whether to render the pointing arrow.',
      },
    ],
    events: [
      {
        name: 'open-change',
        description:
          'CustomEvent<{ open: boolean }> fired when the Zag machine opens or closes the tooltip. The machine is the source of truth.',
      },
    ],
    slots: [
      {
        name: '(default)',
        description: 'The trigger content — wrapped in the accessible trigger button.',
      },
      {
        name: 'content',
        description: 'Rich tooltip body, overriding the `content` text attribute.',
      },
    ],
  },
};
