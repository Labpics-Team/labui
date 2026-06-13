/*
 * `lab-popover` documentation config — the second positioned overlay, the first
 * dismissable, focus-managed one.
 *
 * The matrix and live example render REAL `<lab-popover>` elements. The panel is
 * hidden until the machine opens it on click, so the grid shows the live TRIGGERS
 * across placement and size; clicking any cell genuinely opens the panel, traps or
 * frees focus per `modal`, and dismisses on Escape / outside-click — all from the
 * Zag machine, nothing faked. The live controls re-point the same axes the machine
 * reads.
 */
import '@labpics/ui-core/popover';
import type { ComponentDoc } from '../template/component-doc.js';

/** Build a real `<lab-popover>` with the given attribute map applied. The default
 * slot becomes the trigger; a slot="content" child is the panel body. */
function makePopover(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const el = document.createElement('lab-popover');
  el.append(document.createTextNode('Open settings'));
  const panel = document.createElement('div');
  panel.setAttribute('slot', 'content');
  panel.textContent =
    'This panel applies its setting immediately and dismisses on outside-click or Escape.';
  el.append(panel);
  el.setAttribute('heading', 'Settings');
  el.setAttribute('closable', '');
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

export const popoverDoc: ComponentDoc = {
  slug: 'popover',
  order: 10,
  tag: 'lab-popover',
  title: 'Popover',
  summary:
    'An interactive panel anchored to a trigger, opened by click. Runs the @zag-js/popover machine through the LabUI seam: the machine owns open-on-click, focus move-in and restore-on-close, dismiss (Escape / outside-click), the optional modal focus-trap + scroll-lock, role="dialog" + aria, and dynamic positioning (Floating UI). The element only paints with semantic --lab-* roles.',
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
    make: makePopover,
  },

  anatomy: [
    {
      index: 1,
      name: 'Trigger',
      description:
        'The Zag trigger element — a real <button>. The machine spreads aria-haspopup="dialog", aria-controls, aria-expanded, the toggle handler and focus restoration here.',
    },
    {
      index: 2,
      name: 'Backdrop (modal)',
      description:
        'A scrim shown only when modal && open. Reads --lab-bg-overlay-base at --lab-z-modal-underlay. The machine already blocks outside interaction; the scrim is the visual signal.',
    },
    {
      index: 3,
      name: 'Positioner',
      description:
        'The Zag positioner. Floating UI writes --x / --y here (position:fixed, escaping clipping/stacking ancestors without a portal) and mirrors the content z-index into --z-index.',
    },
    {
      index: 4,
      name: 'Content (dialog)',
      description:
        'The floating panel — role="dialog", tabindex=-1, hidden until open, aria-modal when modal. The raised surface (--lab-surface-raised + --lab-label-primary) with a --lab-border-soft hairline, --lab-fx-shadow-major lift, layered at --lab-z-dropdown / --lab-z-modal.',
    },
    {
      index: 5,
      name: 'Heading / description',
      description:
        'Optional title and description elements. When present, the machine wires aria-labelledby / aria-describedby on the dialog from their ids.',
    },
    {
      index: 6,
      name: 'Close trigger',
      description:
        'Optional built-in close button (closable). The machine wires its click handler to dismiss and restore focus to the trigger.',
    },
    {
      index: 7,
      name: 'Arrow',
      description:
        'The optional Zag arrow + tip; the tip inherits --arrow-background (the same raised surface) so it fuses to the panel edge.',
    },
  ],

  meaning: {
    purpose:
      'A popover is an interactive panel that opens from a trigger on click and can hold real content — text, links, a few controls. It is dismissed by Escape or by clicking outside, and on close focus returns to the trigger. Set modal when the task must be finished or cancelled before anything else (it traps focus, locks scroll and dims the page). Use it for a compact, contextual task next to its trigger. It is NOT a tooltip (a passive hover hint with no interactive content) and NOT a full dialog (which owns the whole screen for a blocking task).',
    dos: [
      'Use for a small, contextual cluster of content or controls tied to a trigger.',
      'Let the machine own focus — it moves focus into the panel on open and restores it on close.',
      'Reach for modal only when outside interaction must be blocked; keep the default non-modal otherwise.',
    ],
    donts: [
      "Don't pour a whole form or a long flow into it — that is a dialog or a page.",
      "Don't re-implement dismiss or focus return by hand; the machine owns Escape, outside-click and restore-focus.",
      "Don't use it for a passive label — a tooltip is lighter and correct there.",
    ],
  },

  liveExample: {
    make: () => makePopover({ placement: 'bottom' }),
    // Honest live controls: placement and size are reflected attributes the machine
    // reads; modal really flips the focus-trap + scrim. Clicking the trigger runs
    // the Zag machine (open/close, focus, dismiss) — the primary interaction.
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
      { kind: 'toggle', label: 'Modal', attribute: 'modal' },
    ],
  },

  api: {
    props: [
      {
        name: 'placement',
        type: "Placement ('top' | 'right' | 'bottom' | 'left' (+ '-start' | '-end'))",
        default: "'bottom'",
        description: 'Where the panel sits relative to the trigger (Zag popper).',
      },
      {
        name: 'size',
        type: "'s' | 'm' | 'l'",
        default: "'m'",
        description: 'Control size — drives panel padding and width band.',
      },
      {
        name: 'modal',
        type: 'boolean',
        default: 'false',
        description:
          'When true: focus trap + scroll lock + outside-interaction disabled + scrim shown.',
      },
      {
        name: 'closable',
        type: 'boolean',
        default: 'false',
        description: 'Render a built-in close button wired to the machine.',
      },
      {
        name: 'arrow',
        type: 'boolean',
        default: 'true',
        description: 'Whether to render the pointing arrow.',
      },
      {
        name: 'heading',
        type: 'string',
        description: 'Optional panel heading — wires aria-labelledby on the dialog.',
      },
      {
        name: 'description',
        type: 'string',
        description: 'Optional panel description — wires aria-describedby on the dialog.',
      },
    ],
    events: [
      {
        name: 'open-change',
        description:
          'CustomEvent<{ open: boolean }> fired when the Zag machine opens or closes the popover. The machine is the source of truth.',
      },
    ],
    slots: [
      {
        name: '(default)',
        description: 'The trigger content — wrapped in the accessible trigger button.',
      },
      { name: 'content', description: 'The panel body.' },
    ],
  },
};
