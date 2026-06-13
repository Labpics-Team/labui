/*
 * Section renderers — pure functions `config → DOM`, one per page section.
 *
 * These are CLOSED for modification (craft-arch / OCP): they render whatever a
 * `ComponentDoc` describes for any component, hardcoding no tag and no token.
 * Each function has a single responsibility (one section) and reads only its
 * slice of the contract, so a change to one section never touches another.
 *
 * Every async-shaped section also covers the empty case (craft-frontend P6):
 * an empty axis list, no anatomy parts, no events — each renders an honest
 * empty state, never a blank or broken region.
 */
import type {
  AnatomyPart,
  ApiRow,
  ApiTable,
  ComponentStatus,
  LiveExample,
  Meaning,
  StatesMatrix,
} from './component-doc.js';
import { el } from './dom.js';

/* ── Status badge ─────────────────────────────────────────────────────────── */

/** Honest status pill. A proof reads "Proof", never "Stable". */
export function renderStatusBadge(status: ComponentStatus): HTMLElement {
  const label: Record<ComponentStatus['kind'], string> = {
    proof: 'Proof',
    stable: 'Stable',
    beta: 'Beta',
    todo: 'TODO',
  };
  const badge = el('span', { class: 'status-badge', 'data-status': status.kind }, [
    label[status.kind],
  ]);
  if (status.kind !== 'stable') {
    badge.append(el('span', { class: 'status-note' }, [status.note]));
  }
  return badge;
}

/* ── Section 1: States matrix ─────────────────────────────────────────────── */

/**
 * Render the live cartesian grid. Columns come from the first axis; further axes
 * stack as labelled row groups. Each cell builds a REAL element with that cell's
 * attribute map applied — the matrix is the component, in every combination.
 */
export function renderStatesMatrix(matrix: StatesMatrix): HTMLElement {
  const [columnAxis, ...rowAxes] = matrix.axes;
  if (!columnAxis) {
    // No axes → a single default instance is the honest, complete rendering.
    return el('div', { class: 'matrix matrix-single' }, [matrix.make({})]);
  }

  const table = el('table', { class: 'matrix-table' });

  // Header row: a blank corner cell, then one column per option of the first axis.
  const head = el('thead', {}, [
    el('tr', {}, [
      el('th', { scope: 'col', class: 'matrix-corner' }, [
        rowAxes.map((a) => a.name).join(' × ') || columnAxis.name,
      ]),
      ...columnAxis.options.map((opt) =>
        el('th', { scope: 'col' }, [`${columnAxis.name}: ${opt.label}`]),
      ),
    ]),
  ]);

  // Row groups: the cartesian product of the remaining axes. With no further
  // axes, a single unnamed row holds one cell per column option.
  const rowCombos = cartesian(rowAxes.map((a) => a.options.map((o) => ({ axis: a, opt: o }))));
  const body = el('tbody');
  for (const combo of rowCombos) {
    const rowLabel = combo.map((c) => `${c.axis.name}: ${c.opt.label}`).join(', ') || '—';
    const tr = el('tr', {}, [el('th', { scope: 'row' }, [rowLabel])]);
    for (const colOpt of columnAxis.options) {
      const attrs: Record<string, string | boolean> = {
        [columnAxis.attribute]: colOpt.value,
      };
      for (const c of combo) attrs[c.axis.attribute] = c.opt.value;
      tr.append(el('td', {}, [el('div', { class: 'matrix-cell' }, [matrix.make(attrs)])]));
    }
    body.append(tr);
  }

  table.append(head, body);
  return el('div', { class: 'matrix-scroll', role: 'group', 'aria-label': 'States matrix' }, [
    table,
  ]);
}

/** Cartesian product of option lists. Empty input → one empty combination. */
function cartesian<T>(lists: T[][]): T[][] {
  return lists.reduce<T[][]>(
    (acc, list) => acc.flatMap((row) => list.map((item) => [...row, item])),
    [[]],
  );
}

/* ── Section 2: Anatomy ───────────────────────────────────────────────────── */

/** Render the labelled-parts list. Empty parts → honest empty state. */
export function renderAnatomy(specimen: HTMLElement, parts: AnatomyPart[]): HTMLElement {
  const stage = el('div', { class: 'anatomy-stage' }, [specimen]);
  if (parts.length === 0) {
    return el('div', { class: 'anatomy' }, [stage, emptyState('No anatomy documented yet.')]);
  }
  const list = el(
    'ol',
    { class: 'anatomy-parts' },
    parts.map((part) =>
      el('li', { class: 'anatomy-part' }, [
        el('span', { class: 'anatomy-marker', 'aria-hidden': 'true' }, [part.index]),
        el('div', {}, [el('strong', {}, [part.name]), el('p', {}, [part.description])]),
      ]),
    ),
  );
  return el('div', { class: 'anatomy' }, [stage, list]);
}

/* ── Section 3: Meaning / usage ───────────────────────────────────────────── */

/** Render purpose prose + do/don't columns. */
export function renderMeaning(meaning: Meaning): HTMLElement {
  const guidance = el('div', { class: 'guidance' }, [
    renderGuidanceColumn('Do', 'do', meaning.dos),
    renderGuidanceColumn("Don't", 'dont', meaning.donts),
  ]);
  return el('div', { class: 'meaning' }, [
    el('p', { class: 'meaning-purpose' }, [meaning.purpose]),
    guidance,
  ]);
}

function renderGuidanceColumn(heading: string, tone: 'do' | 'dont', items: string[]): HTMLElement {
  const body =
    items.length === 0
      ? [emptyState('Nothing documented yet.')]
      : [
          el(
            'ul',
            {},
            items.map((item) => el('li', {}, [item])),
          ),
        ];
  return el('div', { class: 'guidance-col', 'data-tone': tone }, [
    el('h3', {}, [heading]),
    ...body,
  ]);
}

/* ── Section 4: Live example ──────────────────────────────────────────────── */

/**
 * Render the playable instance plus its controls. Controls mutate the live
 * element's attributes directly — toggles flip a boolean attribute, selects set
 * an enumerated one. Values are validated against the control's closed option
 * set before being written (craft-frontend P11).
 */
export function renderLiveExample(example: LiveExample): HTMLElement {
  const specimen = example.make();
  const stage = el('div', { class: 'live-stage' }, [specimen]);

  if (example.controls.length === 0) {
    return el('div', { class: 'live' }, [stage]);
  }

  const controls = el('div', {
    class: 'live-controls',
    role: 'group',
    'aria-label': 'Live controls',
  });
  for (const control of example.controls) {
    if (control.kind === 'toggle') {
      const id = `live-${control.attribute}`;
      const input = el('input', { type: 'checkbox', id });
      input.addEventListener('change', () => {
        if (input.checked) specimen.setAttribute(control.attribute, '');
        else specimen.removeAttribute(control.attribute);
      });
      controls.append(el('label', { for: id, class: 'live-control' }, [input, control.label]));
    } else {
      const id = `live-${control.attribute}`;
      const allowed = new Set(control.options.map((o) => String(o.value)));
      const select = el(
        'select',
        { id },
        control.options.map((o) => el('option', { value: String(o.value) }, [o.label])),
      );
      select.addEventListener('change', () => {
        if (allowed.has(select.value)) specimen.setAttribute(control.attribute, select.value);
      });
      controls.append(
        el('label', { for: id, class: 'live-control' }, [`${control.label} `, select]),
      );
    }
  }
  return el('div', { class: 'live' }, [stage, controls]);
}

/* ── Section 5: Props / API ───────────────────────────────────────────────── */

/** Render the props/events/slots reference. Empty groups are skipped. */
export function renderApi(api: ApiTable): HTMLElement {
  const groups: Array<[string, ApiRow[], boolean]> = [
    ['Props / attributes', api.props, true],
    ['Events', api.events, false],
    ['Slots', api.slots, false],
  ];
  const present = groups.filter(([, rows]) => rows.length > 0);
  if (present.length === 0) {
    return el('div', { class: 'api' }, [emptyState('No public API documented yet.')]);
  }
  return el(
    'div',
    { class: 'api' },
    present.map(([heading, rows, withTypes]) => renderApiGroup(heading, rows, withTypes)),
  );
}

function renderApiGroup(heading: string, rows: ApiRow[], withTypes: boolean): HTMLElement {
  const headCells = withTypes
    ? ['Name', 'Type', 'Default', 'Description']
    : ['Name', 'Description'];
  const head = el('thead', {}, [
    el(
      'tr',
      {},
      headCells.map((c) => el('th', { scope: 'col' }, [c])),
    ),
  ]);
  const body = el(
    'tbody',
    {},
    rows.map((row) =>
      el('tr', {}, [
        el('td', {}, [el('code', {}, [row.name])]),
        ...(withTypes
          ? [
              el('td', {}, [row.type ? el('code', {}, [row.type]) : '—']),
              el('td', {}, [row.default ? el('code', {}, [row.default]) : '—']),
            ]
          : []),
        el('td', {}, [row.description]),
      ]),
    ),
  );
  return el('div', { class: 'api-group' }, [
    el('h3', {}, [heading]),
    el('table', { class: 'api-table' }, [head, body]),
  ]);
}

/* ── Shared ───────────────────────────────────────────────────────────────── */

/** An honest, accessible empty state (craft-frontend P6). */
export function emptyState(message: string): HTMLElement {
  return el('p', { class: 'empty-state', role: 'status' }, [message]);
}
