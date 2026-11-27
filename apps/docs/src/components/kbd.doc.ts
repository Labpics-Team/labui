import '@labpics/ui-core/kbd';
import type { ComponentDoc } from '../template/component-doc.js';

function makeKbd(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const kbd = document.createElement('lab-kbd');
  kbd.size = attrs.size === 'l' ? 'l' : 's';
  kbd.keys = ['\u2318', '\u21e7', 'C', 'V'].slice(0, Number(attrs.keys ?? 1));
  return kbd;
}

export const kbdDoc: ComponentDoc = {
  slug: 'kbd',
  order: 3,
  tag: 'lab-kbd',
  title: 'Kbd',
  summary:
    'A key or keyboard shortcut, with one cap per key. Two sizes follow the same Geist typography as the rest of the interface.',
  status: {
    kind: 'beta',
    note: 'Small and large caps, including all four authored key counts, are available on web and Compose.',
  },
  statesMatrix: {
    axes: [
      {
        name: 'Size',
        attribute: 'size',
        options: [
          { label: 'Small', value: 's' },
          { label: 'Large', value: 'l' },
        ],
      },
      {
        name: 'Keys',
        attribute: 'keys',
        options: [1, 2, 3, 4].map((count) => ({ label: String(count), value: String(count) })),
      },
    ],
    make: makeKbd,
  },
  anatomy: [
    {
      index: 1,
      name: 'Key cap',
      description:
        'A subtle vertical gradient, a one-pixel inside border and a soft outside bottom edge. The first key is slightly stronger than the following keys.',
    },
    {
      index: 2,
      name: 'Key label',
      description:
        'Geist Medium at 12 or 16 pixels. Labels stay real text; longer names such as Esc and Ctrl make the cap wider.',
    },
    {
      index: 3,
      name: 'Shortcut',
      description:
        'Ordered key caps with a two-pixel gap. On web, each key is a kbd element nested inside the shortcut kbd.',
    },
  ],
  meaning: {
    purpose:
      'Kbd tells the reader which physical key or combination to press. It has no action of its own.',
    dos: [
      'Use keys for a shortcut, keeping one label per physical key.',
      'Use the default slot or children for a single key.',
      'Use familiar key names, and provide a readable accessible label when a glyph needs explanation.',
    ],
    donts: [
      'Do not use a key cap as a clickable button.',
      'Do not put a whole shortcut such as Ctrl+Shift+P inside a single cap.',
    ],
  },
  liveExample: {
    make: () => makeKbd({ size: 's', keys: '3' }),
    controls: [
      {
        kind: 'select',
        label: 'Size',
        attribute: 'size',
        options: [
          { label: 'Small', value: 's' },
          { label: 'Large', value: 'l' },
        ],
      },
    ],
  },
  api: {
    props: [
      {
        name: 'size',
        type: "'s' | 'l'",
        default: "'s'",
        description:
          'Small 16px or large 24px minimum cap height. The previous m spelling remains an alias for l.',
      },
      {
        name: 'keys',
        type: 'readonly string[]',
        default: '[]',
        description:
          'An ordered shortcut. An empty list uses the default slot or children. Lit also accepts a JSON keys attribute.',
      },
    ],
    events: [],
    slots: [
      { name: '(default) / children', description: 'One key label when keys is empty or omitted.' },
    ],
  },
};
