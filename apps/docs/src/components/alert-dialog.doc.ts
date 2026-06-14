/*
 * `lab-alert-dialog` documentation config — the stricter dialog.
 *
 * The matrix and live example render REAL `<lab-alert-dialog>` elements. Identical to
 * `<lab-dialog>` in machinery (portal, trap, scroll-lock, focus) but role="alertdialog"
 * — which the machine reads to REFUSE outside-click dismissal and announce an
 * interrupting alert. The dialog must be resolved by an explicit confirm or cancel
 * (Escape still cancels). The projected body holds confirm/cancel controls, relocated
 * into the portal and trapped.
 */
import '@labpics/ui-core/alert-dialog';
import type { ComponentDoc } from '../template/component-doc.js';

/** Build a real `<lab-alert-dialog>` with the given attribute map applied. The default
 * slot becomes the trigger; a slot="content" child carries the confirm/cancel controls
 * (relocated into the portal on first render). */
function makeAlertDialog(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const el = document.createElement('lab-alert-dialog');
  el.append(document.createTextNode('Delete item'));
  const body = document.createElement('div');
  body.setAttribute('slot', 'content');
  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.textContent = 'Delete';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = 'Cancel';
  body.append(confirm, cancel);
  el.append(body);
  el.setAttribute('heading', 'Delete this item?');
  el.setAttribute('description', 'This action cannot be undone.');
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

export const alertDialogDoc: ComponentDoc = {
  slug: 'alert-dialog',
  order: 12,
  tag: 'lab-alert-dialog',
  title: 'Alert-Dialog',
  summary:
    'A blocking confirmation that demands an explicit decision. It is the dialog with role="alertdialog" — and the @zag-js/dialog machine reads that role to REFUSE outside-click dismissal (the decision must be a confirm or a cancel, never an accidental scrim click), announce an interrupting alert, and default initial focus to the close trigger. Escape still cancels. Everything else — the body portal that makes the focus-trap real, scroll-lock, scrim, aria, focus move-in + restore — is inherited from the dialog.',
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
    ],
    make: makeAlertDialog,
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
      name: 'Content (alertdialog)',
      description:
        'The panel — role="alertdialog", tabindex=-1, aria-modal. Because the role is alertdialog, the machine sets closeOnInteractOutside to false: an outside click does NOT dismiss it. The raised surface with the --lab-* roles, layered at --lab-z-modal in the body portal.',
    },
    {
      index: 3,
      name: 'Heading / description',
      description:
        'The question and its consequence. Strongly recommended (an alert without a question is not an alert). When present, the machine wires aria-labelledby / aria-describedby on the dialog.',
    },
    {
      index: 4,
      name: 'Confirm / cancel (body)',
      description:
        'The projected slot="content" controls — the explicit decision. Relocated into the portal content so they live inside the focus-trap subtree and are reachable by Tab.',
    },
    {
      index: 5,
      name: 'Close trigger',
      description:
        'The built-in close button (closable, default on) — the canonical cancel and the machine default initialFocus target.',
    },
  ],

  meaning: {
    purpose:
      'An alert-dialog interrupts to demand a decision that should not happen by accident. Use it for destructive or irreversible confirmations — delete, discard, sign-out-everywhere. It is the dialog with role="alertdialog", and that role makes the machine REFUSE outside-click dismissal: the only ways out are a confirm action, a cancel action, the close button, or Escape (the keyboard cancel). Always give it a clear question (heading) and consequence (description), and put the confirm and cancel controls in the body. It is NOT a plain dialog (which dismisses on outside-click) and NOT a toast or inline message (which do not block).',
    dos: [
      'Use for a destructive or irreversible decision that must be explicit.',
      'Phrase the heading as the question and the description as the consequence.',
      'Provide both a confirm and a cancel control in the body; keep the close button as the safe default focus.',
      'Trust the machine: it refuses outside-click, traps focus, locks scroll, and restores focus on close.',
    ],
    donts: [
      "Don't use it for a non-blocking message — that is a toast, a banner, or inline text.",
      "Don't make confirm the default focus for a destructive action; the safe control (cancel / close) is the machine default.",
      "Don't re-enable outside-click dismissal for a destructive decision — the whole point of the alert role is that it cannot be dismissed by accident.",
      "Don't omit the heading; an alert without a question is just a dialog.",
    ],
  },

  liveExample: {
    make: () => makeAlertDialog({ size: 'm' }),
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
          'When true: focus trap + scroll lock + outside-content hidden + scrim. An alert-dialog is modal by intent; the role already disables outside-click dismissal regardless.',
      },
      {
        name: 'closable',
        type: 'boolean',
        default: 'true',
        description:
          'Render the built-in close button — the canonical cancel and the machine default initialFocus target.',
      },
      {
        name: 'heading',
        type: 'string',
        description: 'The question — wires aria-labelledby on the dialog. Strongly recommended.',
      },
      {
        name: 'description',
        type: 'string',
        description: 'The consequence — wires aria-describedby on the dialog.',
      },
    ],
    events: [
      {
        name: 'open-change',
        description:
          'CustomEvent<{ open: boolean }> fired when the Zag machine opens or closes the alert-dialog. The machine is the source of truth.',
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
          'The confirm / cancel controls — relocated into the portal content so they are inside the trap.',
      },
    ],
  },
};
