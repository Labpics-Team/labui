/*
 * `lab-breadcrumb` documentation config — a PRESENTATIONAL navigation primitive
 * that legitimately opts out of the Zag seam (core-CONTRACT §1): it owns none of
 * open / value / pressed / roving-focus / typeahead, so there is nothing for a
 * machine to be the source of truth of.
 *
 * The states matrix and live example render REAL `<lab-breadcrumb>` elements with
 * a fixed crumb trail (set as the `.items` property). The `size` and `separator`
 * attributes are reflected and read by the element's own styles/markup, so the
 * live controls genuinely re-render it. Nothing is faked.
 */
import '@labpics/ui-core/breadcrumb';
import type { LabBreadcrumbItem } from '@labpics/ui-core/breadcrumb';
import type { ComponentDoc } from '../template/component-doc.js';

const DEMO_CRUMBS: ReadonlyArray<LabBreadcrumbItem> = [
  { label: 'Home', href: '#home' },
  { label: 'Library', href: '#library' },
  { label: 'Components', href: '#components' },
  { label: 'Breadcrumb' },
];

/** Build a real `<lab-breadcrumb>` with the demo trail and the given attributes. */
function makeBreadcrumb(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const el = document.createElement('lab-breadcrumb');
  el.items = DEMO_CRUMBS;
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

export const breadcrumbDoc: ComponentDoc = {
  slug: 'breadcrumb',
  order: 10,
  tag: 'lab-breadcrumb',
  title: 'Breadcrumb',
  summary:
    'The trail of ancestor pages leading to the current one. Presentational (no machine): a native <nav aria-label="Breadcrumb"><ol> of links, the final crumb marked aria-current="page". Reads only semantic --lab-* roles.',
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
        name: 'Separator',
        attribute: 'separator',
        options: [
          { label: 'Slash', value: '/' },
          { label: 'Chevron', value: '›' },
          { label: 'Dot', value: '·' },
        ],
      },
    ],
    make: makeBreadcrumb,
  },

  anatomy: [
    {
      index: 1,
      name: 'Nav landmark',
      description:
        'A real <nav aria-label="Breadcrumb"> so assistive tech exposes the trail as a navigation landmark.',
    },
    {
      index: 2,
      name: 'Ordered list',
      description:
        'An <ol> — the crumbs are ordered root → current. A flex row that wraps on narrow widths.',
    },
    {
      index: 3,
      name: 'Link crumb',
      description:
        'An intermediate crumb — a real <a href> reading --lab-label-secondary, → --lab-label-accent on hover.',
    },
    {
      index: 4,
      name: 'Current crumb',
      description:
        'The final crumb — text (not a link) with aria-current="page", reading --lab-label-primary.',
    },
    {
      index: 5,
      name: 'Separator',
      description:
        'The aria-hidden glyph between crumbs (default "/"), reading --lab-label-tertiary so screen readers announce the trail, not the punctuation.',
    },
  ],

  meaning: {
    purpose:
      "A breadcrumb shows where the current page sits in the site hierarchy and offers one-click escape to any ancestor. Use it on deep, hierarchical structures where users arrive mid-tree (search, deep links) and need orientation. It complements primary navigation — it never replaces it — and it reflects HIERARCHY, not the user's click history (that is the back button).",
    dos: [
      'Order crumbs root → current, and mark the last as the current page (no link).',
      'Use it on deep hierarchies where a page has a clear single parent chain.',
      'Keep labels identical to the page titles they point to.',
    ],
    donts: [
      "Don't make the current (last) crumb a link — you don't navigate to where you already are.",
      "Don't use a breadcrumb as the primary navigation, or to record click history.",
      "Don't hardcode colours — it only ever reads --lab-* roles bound by an ancestor.",
    ],
  },

  liveExample: {
    make: () => makeBreadcrumb({}),
    // Honest live controls: size and separator are reflected attributes the
    // element reads, so flipping them really re-renders the trail.
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
        label: 'Separator',
        attribute: 'separator',
        options: [
          { label: 'Slash', value: '/' },
          { label: 'Chevron', value: '›' },
          { label: 'Dot', value: '·' },
        ],
      },
    ],
  },

  api: {
    props: [
      {
        name: 'items',
        type: 'LabBreadcrumbItem[]',
        default: '[]',
        description:
          'The crumbs, root → current: { label, href? }. A JS property (not an attribute). Omit href on the final crumb — it is the current page, not a link.',
      },
      {
        name: 'size',
        type: "'s' | 'm' | 'l'",
        default: "'m'",
        description: 'Text + spacing density.',
      },
      {
        name: 'separator',
        type: 'string',
        default: "'/'",
        description:
          'The glyph drawn between crumbs (aria-hidden). The React twin also accepts a ReactNode for an icon separator.',
      },
    ],
    events: [],
    slots: [],
  },
};
