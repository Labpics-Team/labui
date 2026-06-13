/*
 * `lab-kbd` documentation config — a presentational primitive documented through
 * the closed docs template (the renderer is untouched; craft-arch / OCP).
 */
import '@labpics/ui-core/kbd';
import type { ComponentDoc } from '../template/component-doc.js';

/** Build a real `<lab-kbd>` with the given attribute map applied. */
function makeKbd(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const kbd = document.createElement('lab-kbd');
  kbd.textContent = typeof attrs.__text === 'string' ? attrs.__text : '⌘';
  for (const [key, value] of Object.entries(attrs)) {
    if (key === '__text') continue;
    if (value === false) continue;
    if (value === true) kbd.setAttribute(key, '');
    else kbd.setAttribute(key, String(value));
  }
  return kbd;
}

export const kbdDoc: ComponentDoc = {
  slug: 'kbd',
  tag: 'lab-kbd',
  title: 'Kbd',
  summary:
    'A single keyboard key, rendered as a raised, monospaced cap. Three sizes, built on a real <kbd> element so assistive tech reads it as keyboard input — styled only from semantic --lab-* roles, identical on the Lit and native-React renderers.',
  status: {
    kind: 'beta',
    note: 'API and behaviour are production-frozen and rendered identically on Lit + React. It consumes only neutral surface/border roles + the shadow stack; no PROVISIONAL colour is in its path.',
  },

  statesMatrix: {
    // One axis — Size — is the honest Figma model for Kbd (the 8 variants are the
    // size ladder × the raised-cap styling). Each cell is a real key cap.
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
    make: makeKbd,
  },

  anatomy: [
    {
      index: 1,
      name: 'Cap (kbd)',
      description:
        'A real <kbd> element — the semantic carrier of "keyboard input". Its surface reads --lab-fill-neutral-tinted, its rim --lab-border-neutral, and a thin bottom-biased shadow from --lab-fx-shadow-penumbra gives the raised, standing-above-the-page look.',
    },
    {
      index: 2,
      name: 'Key text slot',
      description:
        'The default slot (Lit) / children (React) carrying the key glyph or name — a letter, a symbol like ⌘, or a word like Esc. Monospaced so multiple caps line up.',
    },
  ],

  meaning: {
    purpose:
      'Kbd shows a key the user can press — a single key or, side by side, a shortcut like ⌘ + K. It is documentation of an input, not a control: pressing the on-screen cap does nothing; it tells the reader which physical key to hit.',
    dos: [
      'Use one Kbd per key and place several side by side for a chord (⌘ K), with a real "+" or a gap between them.',
      'Put the canonical key name or glyph inside — Esc, ⌘, ⏎, A — matching what is printed on the keyboard.',
      'Match the size to the surrounding text so the cap sits on the same line without distorting it.',
    ],
    donts: [
      "Don't wire a click handler to a Kbd — it documents a key, it is not a button.",
      'Don\'t cram a whole shortcut into one cap ("Ctrl+Shift+P"); use one cap per key.',
      "Don't hardcode a colour; the cap only ever reads --lab-* roles bound by the active theme on an ancestor.",
    ],
  },

  liveExample: {
    // Size is the one reflected axis; it genuinely re-styles the live cap.
    make: () => makeKbd({ size: 'm', __text: '⌘' }),
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
        description: 'Cap size. Drives min-size, padding, and font size from --lab-* tokens.',
      },
    ],
    events: [],
    slots: [
      {
        name: '(default) / children',
        description: 'The key glyph or name. Lit uses the default <slot>; React uses children.',
      },
    ],
  },
};
