/*
 * `lab-avatar` documentation config — a presentational primitive documented
 * through the closed docs template (the renderer is untouched; craft-arch / OCP).
 *
 * Honesty (owner's iron rule): the fallback is real — the matrix and live example
 * use INITIALS (no image src), which is exactly what a user with no photo sees.
 * No broken-image icon is dressed up as a face.
 */
import '@labpics/ui-core/avatar';
import type { ComponentDoc } from '../template/component-doc.js';

/** Build a real `<lab-avatar>` with the given attribute map applied. */
function makeAvatar(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const avatar = document.createElement('lab-avatar');
  // Default to a name so the initials fallback is exercised honestly; a cell may
  // override it via the attrs map.
  if (!('name' in attrs)) avatar.setAttribute('name', 'Ada Lovelace');
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false) continue;
    if (value === true) avatar.setAttribute(key, '');
    else avatar.setAttribute(key, String(value));
  }
  return avatar;
}

export const avatarDoc: ComponentDoc = {
  slug: 'avatar',
  order: 5,
  tag: 'lab-avatar',
  title: 'Avatar',
  summary:
    'A circular avatar with an honest image→initials→default fallback and an optional status dot. Three sizes, six initials-colour families, and four presence states — built only on semantic --lab-* roles, identical on the Lit and native-React renderers.',
  status: {
    kind: 'beta',
    note: 'API and behaviour are production-frozen and rendered identically on Lit + React. The colour axis covers six families from the LabUI role contract. Adding teal/mint/indigo/purple/pink requires the LabUI owner to declare their paints and component bindings. PROVISIONAL where the solid neutral fill the offline dot pairs is owner-pending.',
  },

  statesMatrix: {
    // Columns = Color (the initials-background family). Rows = Status, so the grid
    // shows every colour with each presence indicator — all as the honest initials
    // fallback (no image), which is what a user with no photo sees.
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
        ],
      },
      {
        name: 'Status',
        attribute: 'status',
        options: [
          { label: 'None', value: 'none' },
          { label: 'Online', value: 'online' },
          { label: 'Away', value: 'away' },
          { label: 'DND', value: 'dnd' },
          { label: 'Offline', value: 'offline' },
        ],
      },
    ],
    make: makeAvatar,
  },

  anatomy: [
    {
      index: 1,
      name: 'Disc',
      description:
        'The circular container. With an image it clips the photo to the circle; without one it is a tinted disc — --lab-fill-{color}-primary background with --lab-label-{color}-primary text — that holds the initials or the default glyph.',
    },
    {
      index: 2,
      name: 'Image',
      description:
        'The photo, when src is set and it loads. If it errors, an onError/@error listener flips to the initials fallback for real — a broken URL never shows a broken-image icon.',
    },
    {
      index: 3,
      name: 'Initials / default glyph',
      description:
        'The fallback when there is no usable image: initials derived from name (first + last word), or, with no name, a neutral person glyph. The disc carries role="img" + aria-label=name so it is announced as one named avatar, not read letter by letter.',
    },
    {
      index: 4,
      name: 'Status dot',
      description:
        'An optional corner indicator. online reads --lab-border-success-strong, away --lab-border-warning-strong, dnd --lab-border-danger-strong, offline the neutral fill. A ring in --lab-bg-primary separates it from the disc, and a visually-hidden label carries its meaning so it is not colour-only.',
    },
  ],

  meaning: {
    purpose:
      'Avatar represents a person or entity in a small circle. It prefers their photo, falls back to their initials, and finally to a neutral glyph — always showing SOMETHING recognisable, never a broken image. An optional status dot shows presence (online / away / do-not-disturb / offline).',
    dos: [
      'Always pass name — it drives the initials fallback AND the accessible name, so the avatar works with or without a photo.',
      'Use the status dot only when presence is genuinely known and relevant; hide it (status="none") otherwise.',
      'Pick the initials colour to disambiguate people consistently (e.g. derive it from the user id), not at random per render.',
      'Let the fallback do its job — pass src and trust the element to drop to initials if it fails to load.',
    ],
    donts: [
      "Don't ship an avatar with no name and no src — it can only show the anonymous glyph and has no accessible name.",
      'Don\'t show a status dot you can\'t back with real presence data — a stale "online" is a lie.',
      "Don't hardcode a colour; the disc and dot only ever read --lab-* roles bound by the active theme on an ancestor.",
      "Don't rely on the dot's colour alone — the visually-hidden label carries its meaning for screen-reader users.",
    ],
  },

  liveExample: {
    // Color and Status are reflected axes that genuinely re-style the live avatar;
    // the example uses the honest initials fallback (a name, no image).
    make: () => makeAvatar({ color: 'brand', status: 'online' }),
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
        label: 'Color',
        attribute: 'color',
        options: [
          { label: 'Neutral', value: 'neutral' },
          { label: 'Brand', value: 'brand' },
          { label: 'Danger', value: 'danger' },
          { label: 'Warning', value: 'warning' },
          { label: 'Success', value: 'success' },
          { label: 'Info', value: 'info' },
        ],
      },
      {
        kind: 'select',
        label: 'Status',
        attribute: 'status',
        options: [
          { label: 'None', value: 'none' },
          { label: 'Online', value: 'online' },
          { label: 'Away', value: 'away' },
          { label: 'DND', value: 'dnd' },
          { label: 'Offline', value: 'offline' },
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
        description: 'Avatar diameter. Reflected attribute.',
      },
      {
        name: 'color',
        type: "'neutral' | 'brand' | 'danger' | 'warning' | 'success' | 'info'",
        default: "'neutral'",
        description: 'Initials background / label colour family. Reflected attribute.',
      },
      {
        name: 'status',
        type: "'none' | 'online' | 'offline' | 'away' | 'dnd'",
        default: "'none'",
        description: 'Presence indicator. Reflected attribute; none hides the dot.',
      },
      {
        name: 'src',
        type: 'string',
        default: '—',
        description:
          'Image URL. When present and it loads, the image wins; on error it falls back.',
      },
      {
        name: 'name',
        type: 'string',
        default: "''",
        description: 'Derives the initials AND serves as the accessible name (alt / aria-label).',
      },
    ],
    events: [],
    slots: [],
  },
};
