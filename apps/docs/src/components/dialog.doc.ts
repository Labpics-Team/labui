/*
 * `lab-dialog` documentation config — the first TRUE modal overlay.
 *
 * The matrix and live example render REAL `<lab-dialog>` elements. The panel is hidden
 * until the machine opens it on the trigger click, so the grid shows the live TRIGGERS
 * across size; clicking any cell genuinely opens the dialog, locks scroll, shows the
 * scrim, TRAPS focus, and dismisses on Escape / outside-click — all from the Zag
 * machine, nothing faked.
 *
 * Focus-trap — the honest story: unlike `<lab-popover>` (which keeps content in its own
 * shadow root, so a slotted focusable escapes the trap), `<lab-dialog>` PORTALS its
 * floating layer to `document.body` and RELOCATES the projected `slot="content"` body
 * into that portal. The body therefore lives inside the content element's subtree the
 * trap walks, so slotted controls ARE trapped — a real modal trap, no caveat. That is
 * required: a modal that leaks focus is an a11y bug.
 */
import '@labpics/ui-core/dialog';
import type { ComponentDoc } from '../template/component-doc.js';

/** Build a real `<lab-dialog>` with the given attribute map applied. The default slot
 * becomes the trigger; a slot="content" child is the dialog body (relocated into the
 * portal on first render). */
function makeDialog(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const el = document.createElement('lab-dialog');
  el.append(document.createTextNode('Open dialog'));
  const body = document.createElement('div');
  body.setAttribute('slot', 'content');
  body.textContent =
    'This task owns the screen until it is finished or dismissed. Tab cycles within the dialog; Escape or an outside click closes it.';
  el.append(body);
  el.setAttribute('heading', 'Dialog');
  el.setAttribute('description', 'A blocking task surface.');
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

export const dialogDoc: ComponentDoc = {
  slug: 'dialog',
  order: 11,
  tag: 'lab-dialog',
  title: 'Dialog',
  summary:
    'A modal task surface anchored to nothing — centered, scrim-backed, focus-trapping. Runs the @zag-js/dialog machine through the LabUI seam: the machine owns open-on-click, focus move-in and restore-on-close, dismiss (Escape / outside-click), the modal focus-trap + scroll-lock + outside-content hiding, role="dialog" + aria. The Lit element portals its floating layer to <body> and relocates the slotted body there so the trap is real for slotted controls. The element only paints with semantic --lab-* roles.',
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
        name: 'Modal',
        attribute: 'modal',
        options: [
          { label: 'Modal', value: 'true' },
          { label: 'Non-modal', value: 'false' },
        ],
      },
    ],
    make: makeDialog,
  },

  anatomy: [
    {
      index: 1,
      name: 'Trigger',
      description:
        'The Zag trigger element — a real <button> in the element shadow root. The machine spreads aria-haspopup="dialog", aria-controls, aria-expanded, the toggle handler and focus restoration here.',
    },
    {
      index: 2,
      name: 'Portal',
      description:
        'A light-DOM host appended to document.body with its own shadow root carrying the floating styles. The floating layer renders here (not in the element shadow) so the relocated body sits in the focus-trap subtree. It mirrors the page data-theme / data-material so roles resolve identically.',
    },
    {
      index: 3,
      name: 'Backdrop (modal)',
      description:
        'A scrim shown only when modal && open. Reads --lab-bg-overlay-base at --lab-z-modal-underlay. The machine already blocks outside interaction; the scrim is the visual signal.',
    },
    {
      index: 4,
      name: 'Positioner',
      description:
        'A viewport-filling flex frame that centers the panel (a dialog is not anchored to its trigger, so there is no Floating UI). Gated hidden while closed so it never intercepts pointer events.',
    },
    {
      index: 5,
      name: 'Content (dialog)',
      description:
        'The panel — role="dialog", tabindex=-1, hidden until open, aria-modal when modal. The raised surface (--lab-surface-raised + --lab-label-primary) with a --lab-border-soft hairline, --lab-fx-shadow-major lift, layered at --lab-z-modal.',
    },
    {
      index: 6,
      name: 'Heading / description',
      description:
        'Optional title and description elements. When present (and detected by the machine), it wires aria-labelledby / aria-describedby on the dialog from their ids.',
    },
    {
      index: 7,
      name: 'Body',
      description:
        'The relocated slot="content" nodes — physically moved out of the host light DOM into the portal content so they live inside the trap subtree (slotted focusables ARE trapped).',
    },
    {
      index: 8,
      name: 'Close trigger',
      description:
        'Optional built-in close button (closable, default on). The machine wires its click handler to dismiss and restore focus to the trigger.',
    },
  ],

  meaning: {
    purpose:
      'A dialog is a blocking task surface: it opens from a trigger, dims and locks the page behind a scrim, traps focus inside the panel, and returns focus to the trigger on close. Use it for a self-contained task that must be finished or explicitly dismissed — a form, a confirmation with detail, a focused flow. Unlike the Lit popover, the dialog portals its floating layer to <body> and relocates the projected body there, so the focus-trap is REAL for slotted controls (a modal that leaks focus is an a11y bug). It is NOT a popover (a compact panel anchored to its trigger) and NOT a tooltip (a passive hint). For a decision that must not be dismissed by an accidental outside click, reach for the Alert-Dialog.',
    dos: [
      'Use for a self-contained, blocking task that owns the screen until done or dismissed.',
      'Let the machine own focus — it moves focus into the panel on open and restores it to the trigger on close.',
      'Give the dialog a heading and description so the machine can wire aria-labelledby / aria-describedby.',
      'Project interactive controls through slot="content" — they are relocated into the portal and trapped.',
    ],
    donts: [
      "Don't use it for a passive hint (tooltip) or a compact anchored panel (popover).",
      "Don't re-implement dismiss, scroll-lock or focus return by hand; the machine owns Escape, outside-click, scroll-lock and restore-focus.",
      "Don't rely on outside-click to confirm a destructive decision — use the Alert-Dialog, which refuses outside-click dismissal.",
      "Don't set modal=false for a task that must block the page; non-modal is for a light, dismissable panel only.",
    ],
  },

  liveExample: {
    make: () => makeDialog({ size: 'm' }),
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
        label: 'Modal',
        attribute: 'modal',
        options: [
          { label: 'Modal', value: 'true' },
          { label: 'Non-modal', value: 'false' },
        ],
      },
      { kind: 'toggle', label: 'Closable', attribute: 'closable' },
    ],
  },

  api: {
    props: [
      {
        name: 'size',
        type: "'s' | 'm' | 'l'",
        default: "'m'",
        description: 'Control size — drives panel width band and padding.',
      },
      {
        name: 'modal',
        type: 'boolean',
        default: 'true',
        description:
          'When true: focus trap + scroll lock + outside-content hidden + scrim shown. The Lit element portals the floating layer to <body> and relocates the slotted body there, so the trap is real for slotted controls (no popover-style caveat).',
      },
      {
        name: 'closable',
        type: 'boolean',
        default: 'true',
        description: 'Render a built-in close button wired to the machine.',
      },
      {
        name: 'heading',
        type: 'string',
        description: 'Optional dialog heading — wires aria-labelledby on the content.',
      },
      {
        name: 'description',
        type: 'string',
        description: 'Optional dialog description — wires aria-describedby on the content.',
      },
    ],
    events: [
      {
        name: 'open-change',
        description:
          'CustomEvent<{ open: boolean }> fired when the Zag machine opens or closes the dialog. The machine is the source of truth.',
      },
    ],
    slots: [
      {
        name: '(default)',
        description: 'The trigger content — wrapped in the accessible trigger button.',
      },
      {
        name: 'content',
        description:
          'The dialog body — relocated into the portal content so its focusables are inside the trap.',
      },
    ],
  },
};
