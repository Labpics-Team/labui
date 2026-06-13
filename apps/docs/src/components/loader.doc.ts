/*
 * `lab-loader` documentation config — a presentational primitive documented
 * through the closed docs template (the renderer is untouched; craft-arch / OCP).
 *
 * Honesty (owner's iron rule): the loader is INDETERMINATE only — the page never
 * shows a fake progress number, and the API table says so plainly.
 */
import '@labpics/ui-core/loader';
import type { ComponentDoc } from '../template/component-doc.js';

/** Build a real `<lab-loader>` with the given attribute map applied. */
function makeLoader(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const loader = document.createElement('lab-loader');
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false) continue;
    if (value === true) loader.setAttribute(key, '');
    else loader.setAttribute(key, String(value));
  }
  return loader;
}

export const loaderDoc: ComponentDoc = {
  slug: 'loader',
  tag: 'lab-loader',
  title: 'Loader',
  summary:
    'An indeterminate spinner that announces a busy state. Three sizes, drawn from currentColor and stilled under prefers-reduced-motion, with role="status" / aria-busy — built only on semantic --lab-* roles, identical on the Lit and native-React renderers.',
  status: {
    kind: 'beta',
    note: 'API and behaviour are production-frozen and rendered identically on Lit + React. Indeterminate by design — it carries no progress value; a determinate Progress bar is a separate component. No PROVISIONAL colour is in its path.',
  },

  statesMatrix: {
    // One axis — Size — is the honest Figma model (4 variants = the size ladder).
    // The matrix shows real, live, spinning loaders in each size.
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
    make: makeLoader,
  },

  anatomy: [
    {
      index: 1,
      name: 'Spinner ring',
      description:
        'A circular border with one transparent edge, rotated by a CSS animation. It is drawn from currentColor — the consumer paints it by setting a --lab-* colour role on or above the loader — and is aria-hidden, because it is decoration.',
    },
    {
      index: 2,
      name: 'Status region',
      description:
        'The host carries role="status" and aria-busy="true" so assistive tech announces an in-progress operation. A visually-hidden live region holds the accessible name (the label attribute, default "Loading…").',
    },
  ],

  meaning: {
    purpose:
      'Loader says "something is happening, please wait" when you cannot say how long it will take. It is honest about uncertainty: it shows motion, not a percentage. When you DO know progress against a known total, use a determinate Progress bar instead — never a spinner pretending to measure.',
    dos: [
      'Use a loader for waits of unknown length — a request in flight, a page hydrating.',
      'Give it a meaningful label when the context is not obvious ("Saving…", "Loading results…").',
      'Set a colour with a --lab-* role on or above it so the ring reads against its surface.',
      'Size it to its context — small inline, large for a full-section wait.',
    ],
    donts: [
      "Don't fake progress — if you have no real figure, a spinner is honest; a moving bar that isn't tied to work is a lie.",
      "Don't leave a spinner running forever; replace it with the result, an empty state, or an error.",
      "Don't hardcode a colour; it inherits currentColor, which you set from a --lab-* role.",
      'Don\'t rely on motion alone for meaning — the role="status" label carries it for users who can\'t see the spin.',
    ],
  },

  liveExample: {
    // Size genuinely re-styles the live spinner; it is the only honest axis.
    make: () => makeLoader({ size: 'm' }),
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
        description: 'Spinner diameter (stroke scales with it). Reflected attribute.',
      },
      {
        name: 'label',
        type: 'string',
        default: "'Loading…'",
        description:
          'Accessible name announced via the status region. Not visible — the spinner is decoration.',
      },
    ],
    events: [],
    slots: [],
  },
};
