/*
 * `lab-pagination` documentation config — a component that OWNS a page value, so
 * per core-CONTRACT §1 it drives the Behaviors seam rather than opting out: the
 * @zag-js/pagination machine owns the page, derives the range (with ellipses) and
 * wires aria-current and the prev/next bounds.
 *
 * The states matrix and live example render REAL `<lab-pagination>` elements over
 * a fixed data shape (count + page-size). The `size` and `sibling-count`
 * attributes are reflected and re-drive the machine; clicking a page or prev/next
 * runs the machine. Nothing is faked.
 */
import '@labpics/ui-core/pagination';
import type { ComponentDoc } from '../template/component-doc.js';

/** Build a real `<lab-pagination>` over a fixed dataset with the given attributes. */
function makePagination(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const el = document.createElement('lab-pagination');
  el.setAttribute('count', '200');
  el.setAttribute('page-size', '10');
  // Seed a middle page so the matrix shows both ellipses unless overridden.
  if (!('page' in attrs)) el.setAttribute('default-page', '8');
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

export const paginationDoc: ComponentDoc = {
  slug: 'pagination',
  order: 11,
  tag: 'lab-pagination',
  title: 'Pagination',
  summary:
    'Navigate a paged collection one page at a time. Runs the @zag-js/pagination machine through the LabUI seam: the machine owns the page value, derives the page range (with ellipses) from count + page-size, and wires aria-current and the prev/next bounds — the element only paints with semantic --lab-* roles.',
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
        name: 'Sibling count',
        attribute: 'sibling-count',
        options: [
          { label: '0', value: '0' },
          { label: '1', value: '1' },
          { label: '2', value: '2' },
        ],
      },
    ],
    make: makePagination,
  },

  anatomy: [
    {
      index: 1,
      name: 'Nav root',
      description:
        'The Zag root element — a <nav> that scopes the machine and exposes the control group to assistive tech.',
    },
    {
      index: 2,
      name: 'Prev / Next triggers',
      description:
        'The Zag prev/next trigger elements — buttons that step one page and disable at the bounds (reading --lab-label-tertiary when disabled).',
    },
    {
      index: 3,
      name: 'Page item',
      description:
        'The Zag item element — one button per page. The current page reads --lab-fill-accent + --lab-label-on-accent and carries aria-current="page"; the machine owns which is current.',
    },
    {
      index: 4,
      name: 'Ellipsis',
      description:
        'An aria-hidden gap marker the machine inserts when the range is collapsed, reading --lab-label-tertiary.',
    },
  ],

  meaning: {
    purpose:
      'Pagination splits a long, ordered collection into pages and lets the user move between them. Use it when the total set is large but bounded and the user benefits from position ("page 8 of 20") and random access to any page. Prefer it over infinite scroll when users need to find, bookmark, or return to a specific position. For unbounded feeds where position is irrelevant, infinite scroll fits better.',
    dos: [
      'Drive it from your data shape: count (total items) + page-size derive the pages.',
      'Keep the current page obvious and reachable via prev/next AND direct page jumps.',
      'Let the machine own the page value — read page-change, never set aria-current by hand.',
    ],
    donts: [
      "Don't fake a boundary-count knob — the machine fixes the first/last boundary at 1.",
      "Don't use pagination for an unbounded, position-irrelevant feed — that is infinite scroll.",
      "Don't hardcode colours — it only ever reads --lab-* roles bound by an ancestor.",
    ],
  },

  liveExample: {
    make: () => makePagination({}),
    // Honest live controls: size and sibling-count are reflected attributes the
    // machine reads, so flipping them really re-drives the range. Clicking a page
    // or prev/next runs the Zag machine — the primary interaction.
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
        label: 'Sibling count',
        attribute: 'sibling-count',
        options: [
          { label: '0', value: '0' },
          { label: '1', value: '1' },
          { label: '2', value: '2' },
        ],
      },
    ],
  },

  api: {
    props: [
      {
        name: 'count',
        type: 'number',
        default: '0',
        description: 'Total number of data items the pages are derived from.',
      },
      {
        name: 'page-size',
        type: 'number',
        default: '10',
        description: 'Items per page. count / page-size gives the page total.',
      },
      {
        name: 'page',
        type: 'number',
        default: '1',
        description:
          'Current page. Setting the attribute opts into controlled mode (the consumer owns it); otherwise the machine owns it from default-page and mirrors it back onto this property.',
      },
      {
        name: 'default-page',
        type: 'number',
        default: '1',
        description: 'Uncontrolled initial page — read once by the machine at init.',
      },
      {
        name: 'sibling-count',
        type: 'number',
        default: '1',
        description: 'Pages shown either side of the current page.',
      },
      {
        name: 'size',
        type: "'s' | 'm' | 'l'",
        default: "'m'",
        description: 'Control density.',
      },
    ],
    events: [
      {
        name: 'page-change',
        description:
          'CustomEvent<{ page: number; pageSize: number }> fired when the machine changes the page. The machine is the source of truth.',
      },
    ],
    slots: [],
  },
};
