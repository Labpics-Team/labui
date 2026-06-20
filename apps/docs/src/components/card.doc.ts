/*
 * `lab-card` documentation config — a PRESENTATIONAL container that opts OUT of the
 * Zag Behaviors seam (core-CONTRACT §1), like Badge / Loader.
 *
 * The states matrix and live example render REAL `<lab-card>` elements with fixed
 * demo content in the header / body / footer slots. There is no machine — a card
 * has no interaction state to own; the only stateful affordance is the optional
 * `interactive` hover/focus treatment, which is native CSS, not a state machine.
 */
import '@labpics/ui-core/card';
import type { ComponentDoc } from '../template/component-doc.js';

/** Build a real `<lab-card>` with demo header/body/footer content and the given attrs. */
function makeCard(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const el = document.createElement('lab-card');

  const header = document.createElement('div');
  header.setAttribute('slot', 'header');
  header.textContent = 'Project Atlas';

  const body = document.createElement('div');
  body.textContent = 'A self-contained surface that groups related content into one card.';

  const footer = document.createElement('div');
  footer.setAttribute('slot', 'footer');
  footer.textContent = 'Updated 2 days ago';

  el.append(header, body, footer);

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

export const cardDoc: ComponentDoc = {
  slug: 'card',
  order: 13,
  tag: 'lab-card',
  title: 'Card',
  summary:
    'A presentational container that groups related content into a single surface, with optional header / media / body / footer slots. No machine: a card has no interaction state to own, so it honestly opts out of the Zag seam (like Badge) and renders native <article> semantics.',
  status: { kind: 'stable' },

  statesMatrix: {
    axes: [
      {
        name: 'Variant',
        attribute: 'variant',
        options: [
          { label: 'Elevated', value: 'elevated' },
          { label: 'Outlined', value: 'outlined' },
          { label: 'Filled', value: 'filled' },
        ],
      },
      {
        name: 'Padding',
        attribute: 'padding',
        options: [
          { label: 'S', value: 's' },
          { label: 'M', value: 'm' },
          { label: 'L', value: 'l' },
        ],
      },
      {
        name: 'Interactive',
        attribute: 'interactive',
        options: [
          { label: 'Static', value: false },
          { label: 'Interactive', value: true },
        ],
      },
    ],
    make: makeCard,
  },

  anatomy: [
    {
      index: 1,
      name: 'Surface (article)',
      description:
        'The container — a native <article> (the HTML self-contained-composition element). Reads --lab-bg-primary / --lab-bg-secondary; elevated adds an honest --lab-fx-shadow role.',
    },
    {
      index: 2,
      name: 'Media slot',
      description:
        'An edge-to-edge region (slot="media") for an image or thumbnail that bleeds to the card edges regardless of body padding. Collapses when empty.',
    },
    {
      index: 3,
      name: 'Header slot',
      description:
        'A native <header> region (slot="header") for the title / overline. Collapses when empty.',
    },
    {
      index: 4,
      name: 'Body (default slot)',
      description:
        'The primary content region — the default slot, padded by the padding axis. Always present.',
    },
    {
      index: 5,
      name: 'Footer slot',
      description:
        'A native <footer> region (slot="footer") for actions / metadata. Collapses when empty.',
    },
  ],

  meaning: {
    purpose:
      'A card collects a coherent chunk of content — a product, an article preview, a settings group — into one bounded surface the user reads as a unit. Use it to give a self-contained composition visual edges and a clear grouping. A card is a container, NOT a control: when the whole card is clickable, the actionable element is a real button or link the consumer slots in — the card only adds the interactive hover/focus affordance, never a fabricated role or name.',
    dos: [
      'Use to group one coherent unit of content (one product, one article preview, one summary).',
      'Slot a real <a>/<button> when the card is actionable — keep keyboard + screen-reader semantics honest.',
      'Pick the variant for elevation hierarchy: elevated to float, outlined to delineate, filled to recede.',
    ],
    donts: [
      "Don't make the whole card interactive without a real focusable control inside — that is a keyboard trap.",
      "Don't nest cards inside cards — the elevation language stops meaning anything.",
      "Don't pour unrelated content into one card; a card is a grouping, not a generic <div>.",
    ],
  },

  liveExample: {
    make: () => makeCard({}),
    // Honest live controls: variant / padding are reflected attributes the element
    // styles on; interactive flips the hover/focus affordance. No machine to drive —
    // a card is presentational, and these controls only re-skin the surface.
    controls: [
      {
        kind: 'select',
        label: 'Variant',
        attribute: 'variant',
        options: [
          { label: 'Elevated', value: 'elevated' },
          { label: 'Outlined', value: 'outlined' },
          { label: 'Filled', value: 'filled' },
        ],
      },
      {
        kind: 'select',
        label: 'Padding',
        attribute: 'padding',
        options: [
          { label: 'None', value: 'none' },
          { label: 'S', value: 's' },
          { label: 'M', value: 'm' },
          { label: 'L', value: 'l' },
        ],
      },
      { kind: 'toggle', label: 'Interactive', attribute: 'interactive' },
    ],
  },

  api: {
    props: [
      {
        name: 'variant',
        type: "'elevated' | 'outlined' | 'filled'",
        default: "'elevated'",
        description:
          'Surface treatment. Elevated raises the surface with an --lab-fx-shadow role; outlined draws a border; filled tints the surface.',
      },
      {
        name: 'padding',
        type: "'none' | 's' | 'm' | 'l'",
        default: "'m'",
        description: 'Inner spacing of the body / header / footer regions.',
      },
      {
        name: 'interactive',
        type: 'boolean',
        default: 'false',
        description:
          'Adds a hover + focus affordance for whole-card targets. The actionable control is still the consumer’s to slot — the card never fabricates a role.',
      },
    ],
    events: [],
    slots: [
      { name: 'media', description: 'Edge-to-edge media region (image / thumbnail). Optional.' },
      {
        name: 'header',
        description: 'A native <header> region for the title / overline. Optional.',
      },
      { name: '(default)', description: 'The primary body content. Always present.' },
      { name: 'footer', description: 'A native <footer> region for actions / metadata. Optional.' },
    ],
  },
};
