/*
 * `lab-badge` documentation config — a presentational primitive documented
 * through the closed docs template (the renderer is untouched; craft-arch / OCP).
 *
 * Honesty rules (owner's iron rule on stop-gaps): the status badge says exactly
 * what Badge is; every live control mutates a REFLECTED attribute the element
 * re-styles on, never a no-op dressed as a control.
 */
import '@labpics/ui-core/badge';
import type { ComponentDoc } from '../template/component-doc.js';

/** Build a real `<lab-badge>` with the given attribute map applied. */
function makeBadge(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const badge = document.createElement('lab-badge');
  badge.textContent = 'Badge';
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false) continue;
    if (value === true) badge.setAttribute(key, '');
    else badge.setAttribute(key, String(value));
  }
  return badge;
}

export const badgeDoc: ComponentDoc = {
  slug: 'badge',
  order: 2,
  tag: 'lab-badge',
  title: 'Badge',
  summary:
    'A small pill that labels or counts, carrying a sentiment. Eight colour families across two surface kinds (fill / tinted) plus a disabled state, with an optional leading dot — built only on semantic --lab-* roles, identical on the Lit and native-React renderers.',
  status: {
    kind: 'beta',
    note: 'API and behaviour are production-frozen and rendered identically on Lit + React. The colour axis covers the LabUI role families (neutral + 5 sentiments + 2 static). Adding teal/mint/indigo/purple/pink requires the LabUI owner to declare their paints and component bindings. PROVISIONAL where the solid neutral fill it pairs is owner-pending.',
  },

  statesMatrix: {
    // Columns = Color (the sentiment family). Rows = Type × Disabled, so the grid
    // shows every family in both surface kinds and in its disabled presentation.
    axes: [
      {
        name: 'Color',
        attribute: 'color',
        options: [
          { label: 'Neutral', value: 'neutral' },
          { label: 'Brand', value: 'brand' },
          { label: 'Danger', value: 'danger' },
          { label: 'Warning', value: 'warning' },
          { label: 'Success', value: 'success' },
          { label: 'Info', value: 'info' },
          { label: 'Static dark', value: 'static-dark' },
          { label: 'Static light', value: 'static-light' },
        ],
      },
      {
        name: 'Type',
        attribute: 'type',
        options: [
          { label: 'Fill', value: 'fill' },
          { label: 'Tinted', value: 'tinted' },
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
    make: makeBadge,
  },

  anatomy: [
    {
      index: 1,
      name: 'Container (pill)',
      description:
        'The rounded surface. fill reads the opaque sentiment surface (the -strong border primitive, the only full-opacity sentiment colour the contract exposes) with the Badge contrast-label pairing role; tinted reads --lab-fill-{color}-primary @12 with --lab-label-{color}-primary. Separation is always by surface, never a border on top.',
    },
    {
      index: 2,
      name: 'Dot slot',
      description:
        'An optional leading indicator (Lit: slot="dot"; React: dot prop). It inherits the label colour via currentColor, so a status dot matches the badge text without a second role.',
    },
    {
      index: 3,
      name: 'Label slot',
      description:
        'The default slot (Lit) / children (React) carrying the badge text — a short label or a count. Server-rendered into the declarative shadow DOM on the Lit path.',
    },
  ],

  meaning: {
    purpose:
      'Badge labels a thing with a sentiment, or counts it. Its colour carries meaning (danger = a problem, success = a healthy state, warning = attention, info = a note, brand = an accent, neutral = a plain label); its kind carries weight (fill is loudest, tinted is quiet). It is decoration, not a control — it has no action and takes no focus.',
    dos: [
      'Use the colour that matches the meaning — danger for errors, success for healthy states, warning for attention.',
      'Keep the text short: a word or a count, not a sentence.',
      'When the colour is the only thing conveying status, give the badge an accessible name (aria-label) so it is not colour-only.',
      'Use tinted for a quiet inline tag; reserve fill for a badge that must stand out.',
    ],
    donts: [
      "Don't use a badge as a button — it has no action and takes no focus; use Button for actions.",
      "Don't pick a colour for looks against its meaning — a success-green badge on an error is a lie.",
      "Don't hardcode a colour; the badge only ever reads --lab-* roles bound by the active theme on an ancestor.",
      "Don't pack a long phrase into a badge — its job is a glanceable label or count.",
    ],
  },

  liveExample: {
    // Every control mutates a REFLECTED attribute the element re-styles on.
    make: () => makeBadge({ color: 'brand', type: 'fill' }),
    controls: [
      {
        kind: 'select',
        label: 'Color',
        attribute: 'color',
        options: [
          { label: 'Neutral', value: 'neutral' },
          { label: 'Brand', value: 'brand' },
          { label: 'Danger', value: 'danger' },
          { label: 'Warning', value: 'warning' },
          { label: 'Success', value: 'success' },
          { label: 'Info', value: 'info' },
          { label: 'Static dark', value: 'static-dark' },
          { label: 'Static light', value: 'static-light' },
        ],
      },
      {
        kind: 'select',
        label: 'Type',
        attribute: 'type',
        options: [
          { label: 'Fill', value: 'fill' },
          { label: 'Tinted', value: 'tinted' },
        ],
      },
      { kind: 'toggle', label: 'Disabled', attribute: 'disabled' },
    ],
  },

  api: {
    props: [
      {
        name: 'color',
        type: "'neutral' | 'brand' | 'danger' | 'warning' | 'success' | 'info' | 'static-dark' | 'static-light'",
        default: "'neutral'",
        description: 'Sentiment / accent colour family. Reflected attribute; styles key off it.',
      },
      {
        name: 'type',
        type: "'fill' | 'tinted'",
        default: "'fill'",
        description: 'Surface treatment: opaque fill vs. low-alpha tint.',
      },
      {
        name: 'disabled',
        type: 'boolean',
        default: 'false',
        description: 'Dimmed, non-interactive presentation. Reflected for styling.',
      },
    ],
    events: [],
    slots: [
      {
        name: '(default) / children',
        description: 'The badge label or count. Lit uses the default <slot>; React uses children.',
      },
      {
        name: 'dot / dot',
        description:
          'Optional leading indicator. Lit uses slot="dot"; React uses the dot prop. Inherits the label colour.',
      },
    ],
  },
};
