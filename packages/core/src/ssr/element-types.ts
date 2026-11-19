import type { LabPropSpec } from '../adapter-runtime.js';

export interface ElementSsrInputs {
  readonly specs: readonly LabPropSpec[];
  readonly props: Readonly<Record<string, unknown>>;
  /** Scalar native attributes the element can read while rendering. */
  readonly attributes?: Readonly<Record<string, unknown>>;
}

export interface RenderedElementParts {
  readonly attributes: Readonly<Record<string, string>>;
  readonly shadowRoot?: {
    readonly attributes: Readonly<Record<string, string>>;
    readonly contents: string;
  };
  /** DSD alone; no host, framework children, or outer Lit part markers. */
  readonly shadowHtml: string;
}
