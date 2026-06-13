/*
 * `lab-proof` documentation config — the FIRST and only real instance of the
 * docs-page template, filled in for the proof element.
 *
 * `<lab-proof>` is a PROOF, not the production Button — and this page says so,
 * loudly, in its status and prose. It documents the scaffold seam the proof
 * exercises (Lit base + Zag toggle machine + `--lab-*` roles + theme/material
 * agnosticism + SSR), so that when real components arrive each is documented by
 * cloning THIS object's shape, never by editing the template.
 *
 * The element's only variant axis is `pressed` (plus the `disabled` modifier),
 * by design — it is a proof of the seam, not a half-built Button with 432
 * variants. The matrix therefore has two honest axes: State × Disabled.
 */
import '@labpics/ui-core/proof';
import type { ComponentDoc } from '../template/component-doc.js';

/** Build a real `<lab-proof>` with the given attribute map applied. */
function makeProof(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const proof = document.createElement('lab-proof');
  proof.textContent = 'Toggle';
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false) continue;
    // `pressed` is the machine's reflected attribute; in the matrix we want the
    // element to START pressed, which the element exposes via `default-pressed`.
    if (key === 'pressed' && value === true) {
      proof.setAttribute('default-pressed', '');
    } else if (value === true) {
      proof.setAttribute(key, '');
    } else {
      proof.setAttribute(key, String(value));
    }
  }
  return proof;
}

export const proofDoc: ComponentDoc = {
  slug: 'proof',
  tag: 'lab-proof',
  title: 'Proof',
  summary:
    'A proof element — not the production Button. It drives the whole component scaffold seam end to end: Lit base, Zag toggle machine, semantic --lab-* roles, theme/material agnosticism, and server-side rendering.',
  status: {
    kind: 'proof',
    note: 'Validates the scaffold, not a real primitive. The Button is a later chapter and will reuse only this seam.',
  },

  statesMatrix: {
    axes: [
      {
        name: 'State',
        attribute: 'pressed',
        options: [
          { label: 'Default', value: false },
          { label: 'Pressed', value: true },
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
    make: makeProof,
  },

  anatomy: [
    {
      index: 1,
      name: 'Container (button)',
      description:
        'The interactive surface. Reads --lab-fill-neutral-tinted (unpressed) or --lab-fill-accent (pressed) for its background and --lab-border-neutral / --lab-border-accent for its edge. Pure semantic roles, no hex.',
    },
    {
      index: 2,
      name: 'Indicator',
      description:
        'A small dot that brightens when pressed. Uses currentColor, so it tracks the label role and stays correct across themes with zero edits.',
    },
    {
      index: 3,
      name: 'Label slot',
      description:
        'The default <slot> carrying the projected text. Server-rendered into the declarative shadow DOM so first paint is meaningful before any JS runs.',
    },
    {
      index: 4,
      name: 'Focus ring',
      description:
        'A :focus-visible outline drawn from --lab-border-focus. delegatesFocus on the host moves focus to the inner button, so host focus styling and tab order stay correct (a11y).',
    },
  ],

  meaning: {
    purpose:
      'The proof exists to demonstrate, in a real browser, that the LabUI scaffold seam compiles and runs: a Lit base element wired to a real Zag state machine, painted only with semantic --lab-* roles, re-skinning purely from [data-theme] / [data-material] on an ancestor, and server-rendering to declarative shadow DOM. It is intentionally minimal — one axis (pressed) — so it stays a proof, not a half-built component.',
    dos: [
      'Use it to verify the scaffold end to end: behavior (Zag), tokens (var consumption), theming, and SSR.',
      'Read its source as the reference shape for how a real LabUI element consumes roles and a behavior machine.',
      'Flip the Theme and Material switchers above to confirm the element re-skins with zero element edits.',
    ],
    donts: [
      "Don't ship it as a Button or any production control — it has one axis and no production API.",
      "Don't add variants to it; the real Button is a separate chapter that reuses the seam, not this element.",
      "Don't hardcode colours against it — it only ever reads --lab-* roles bound by an ancestor.",
    ],
  },

  liveExample: {
    make: () => makeProof({}),
    controls: [
      { kind: 'toggle', label: 'Disabled', attribute: 'disabled' },
      {
        kind: 'select',
        label: 'Start pressed',
        attribute: 'default-pressed',
        options: [
          { label: 'No', value: '' },
          { label: 'Yes', value: 'true' },
        ],
      },
    ],
  },

  api: {
    props: [
      {
        name: 'default-pressed',
        type: 'boolean',
        default: 'false',
        description:
          'Whether the proof starts pressed. Reflected so SSR and CSS can see the initial state.',
      },
      {
        name: 'disabled',
        type: 'boolean',
        default: 'false',
        description: 'Whether the proof is non-interactive. Reflected for styling and a11y.',
      },
      {
        name: 'pressed',
        type: 'boolean',
        default: 'false',
        description:
          'The machine-driven pressed state, reflected onto the host so :host([pressed]) styling and the SSR attribute follow one source of truth. Read-only in practice — driven by the toggle machine.',
      },
    ],
    events: [
      {
        name: 'click',
        description:
          'Native click on the inner button runs the Zag toggle machine, which flips aria-pressed and the reflected pressed attribute.',
      },
    ],
    slots: [
      {
        name: '(default)',
        description:
          'The label content projected into the button. Falls back to "Toggle" when empty.',
      },
    ],
  },
};
