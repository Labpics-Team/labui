/*
 * Component-doc CONTRACT — the ubiquitous language of a LabUI docs page.
 *
 * This is the single type every component's documentation is expressed in. The
 * template renderer (`render-page.ts`) is CLOSED for modification: it consumes a
 * `ComponentDoc` and emits the page. Documenting a NEW component is OPEN — you
 * add one `ComponentDoc` object to the registry and a route entry, and touch no
 * renderer code (craft-arch / OCP).
 *
 * A `ComponentDoc` is data, never behavior: it has no methods, no DOM, no
 * framework. It names WHAT a component's page says (its states, anatomy,
 * meanings, props, live example) — the renderer owns HOW that becomes DOM. This
 * keeps the contract framework-agnostic: the same object could feed a Vite page
 * today and a Starlight/React page tomorrow without rewriting a component's
 * documentation.
 */

/** A documentation page for one LabUI component, identified by its route slug. */
export interface ComponentDoc {
  /** URL slug + registry key. One per component. e.g. "proof". */
  readonly slug: string;
  /**
   * Optional nav sort weight. The registry is auto-discovered (every
   * `*.doc.ts` is found by glob), so ordering can no longer come from an
   * import sequence. Lower sorts first; ties and omissions fall back to
   * alphabetical-by-slug. A component sets this in its OWN doc file to claim a
   * place in the curated narrative — no shared file is edited, so parallel
   * component batches never collide on ordering.
   */
  readonly order?: number;
  /** The custom-element tag this page documents. e.g. "lab-proof". */
  readonly tag: string;
  /** Human title shown in nav and as the page <h1>. e.g. "Proof". */
  readonly title: string;
  /** One-sentence summary under the title. Plain text, no markup. */
  readonly summary: string;
  /**
   * Honest status badge. A page for a not-yet-real component (a proof, a stub)
   * MUST say so here — never dress a proof up as a finished primitive.
   */
  readonly status: ComponentStatus;

  /** Section 1 — the live states/variants matrix. */
  readonly statesMatrix: StatesMatrix;
  /** Section 2 — labelled anatomy parts. */
  readonly anatomy: AnatomyPart[];
  /** Section 3 — meaning / usage prose: when to use, do & don't. */
  readonly meaning: Meaning;
  /** Section 4 — the interactive live example. */
  readonly liveExample: LiveExample;
  /** Section 5 — props / attributes / events / slots API. */
  readonly api: ApiTable;
}

/** Honest lifecycle status of the documented component. */
export type ComponentStatus =
  | { readonly kind: 'proof'; readonly note: string }
  | { readonly kind: 'stable' }
  | { readonly kind: 'beta'; readonly note: string }
  | { readonly kind: 'todo'; readonly note: string };

/* ── Section 1: States matrix ─────────────────────────────────────────────── */

/**
 * The live grid of every state/variant combination. The renderer takes the
 * cartesian product of all `axes` and, for each cell, builds a REAL element via
 * `make` with that cell's attribute map applied. Nothing is screenshotted or
 * faked — the matrix renders the actual component in every combination.
 */
export interface StatesMatrix {
  /**
   * The variant axes (e.g. Type, Kind, Size, State). The grid columns come from
   * the FIRST axis; remaining axes stack as row groups. An empty array renders a
   * single default instance.
   */
  readonly axes: MatrixAxis[];
  /**
   * Build one real element for a cell. Receives the resolved attribute map for
   * that cell (axis name → chosen option value). Returns a live custom element.
   * Defined per component so the matrix never hardcodes a tag.
   */
  readonly make: (attrs: Readonly<Record<string, string | boolean>>) => HTMLElement;
}

/** One variant axis: a named dimension with a closed set of options. */
export interface MatrixAxis {
  /** Display name of the axis. e.g. "State", "Size". */
  readonly name: string;
  /**
   * The attribute this axis maps to on the element. e.g. "pressed", "disabled".
   * Boolean attributes use `value: true|false`; enumerated attributes use the
   * string token. The renderer applies these to the element built by `make`.
   */
  readonly attribute: string;
  /** The closed set of options along this axis. At least one. */
  readonly options: MatrixOption[];
}

/** One option along an axis. */
export interface MatrixOption {
  /** Cell label shown in the grid header. e.g. "Pressed", "Default". */
  readonly label: string;
  /** The value applied to the axis attribute for this cell. */
  readonly value: string | boolean;
}

/* ── Section 2: Anatomy ───────────────────────────────────────────────────── */

/** One labelled zone of the component, with what it is and why it exists. */
export interface AnatomyPart {
  /** Ordinal shown as the marker. 1-based. */
  readonly index: number;
  /** Name of the part. e.g. "Container", "Indicator", "Label slot". */
  readonly name: string;
  /** What this part does and the semantic role/token it reads. */
  readonly description: string;
}

/* ── Section 3: Meaning / usage ───────────────────────────────────────────── */

/** Prose documentation: the meaning of the component and how to apply it. */
export interface Meaning {
  /** Free prose: what the component means and when it applies. */
  readonly purpose: string;
  /** Concrete "do" guidance. */
  readonly dos: string[];
  /** Concrete "don't" guidance. */
  readonly donts: string[];
}

/* ── Section 4: Live example ──────────────────────────────────────────────── */

/**
 * A single interactive, playable instance plus optional controls that mutate its
 * attributes live. The renderer builds the element with `make`, then renders one
 * control per `controls` entry wired to flip that attribute on the element.
 */
export interface LiveExample {
  /** Build the single live element. */
  readonly make: () => HTMLElement;
  /** Live controls that toggle/select attributes on the example element. */
  readonly controls: LiveControl[];
}

/** One live control bound to an element attribute. */
export type LiveControl =
  | {
      readonly kind: 'toggle';
      readonly label: string;
      /** Boolean attribute flipped on/off. e.g. "disabled". */
      readonly attribute: string;
    }
  | {
      readonly kind: 'select';
      readonly label: string;
      readonly attribute: string;
      readonly options: MatrixOption[];
    };

/* ── Section 5: Props / API ───────────────────────────────────────────────── */

/** The props/attributes/events/slots reference table. */
export interface ApiTable {
  readonly props: ApiRow[];
  readonly events: ApiRow[];
  readonly slots: ApiRow[];
}

/** One API row. `type` and `default` are optional (events/slots omit them). */
export interface ApiRow {
  /** Name of the prop/attribute/event/slot. */
  readonly name: string;
  /** TypeScript-ish type, when applicable. */
  readonly type?: string;
  /** Default value, when applicable. */
  readonly default?: string;
  /** What it does. */
  readonly description: string;
}
