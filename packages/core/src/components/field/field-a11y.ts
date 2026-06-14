/**
 * `field-a11y` — the ONE source of truth for the form-field accessibility wiring
 * shared by `<lab-input>` and `<lab-textarea>` (and their native-React twins).
 *
 * Input and Textarea are PRESENTATIONAL (core-CONTRACT §1 opt-out): `@zag-js` has
 * no plain text-input machine because a native `<input>`/`<textarea>` already owns
 * its value, caret, selection, keyboard and editing — there is no shared
 * interaction state for a machine to be the source of truth of. But a field is NOT
 * just the control: it OWNS the programmatic association of a label, an optional
 * helper/description, and an optional error message to that control. That wiring is
 * real ARIA the platform does NOT give for free, and getting it right is the whole
 * point of the component. So this module computes — once, identically for both
 * renderers — the exact id + ARIA contract a field must apply:
 *
 *   - the control is labelled by a real `<label for>` (the strongest association);
 *   - `aria-describedby` lists the helper id (when helper text is present) AND the
 *     error id (only when invalid), in that reading order — so a screen reader
 *     announces the description and, when relevant, the error;
 *   - `aria-invalid="true"` and `aria-errormessage`→error-id are set ONLY when the
 *     field is invalid AND an error message exists (an empty error region is never
 *     referenced — that would point a reader at nothing);
 *   - `aria-required="true"` reflects the required input.
 *
 * This is a pure function over field inputs → the resolved a11y attribute set and
 * the stable part ids. It holds NO DOM and NO framework, so the Lit element and the
 * React twin cannot drift on the a11y contract — parity is structural, not a second
 * implementation (ADR-0001 applied to a11y instead of colour).
 */

/**
 * Sentiment of a field — the `type` axis. `neutral` is the resting field; the
 * other three are the standard form sentiments (core-CONTRACT §3 names the input
 * sentiment set `danger` / `warning` / `success`).
 */
export type LabFieldType = 'neutral' | 'danger' | 'warning' | 'success';

/** Field control size — the `size` axis, shared with the other form controls. */
export type LabFieldSize = 's' | 'm' | 'l';

/** The semantic state inputs a field's a11y wiring depends on. */
export interface FieldA11yInput {
  /** The control's stable base id. Part ids derive from it, so they never collide. */
  readonly id: string;
  /** Whether the field is in an invalid state (drives aria-invalid / errormessage). */
  readonly invalid: boolean;
  /** Whether the field is required (drives aria-required). */
  readonly required: boolean;
  /** Whether helper/description text is present (drives aria-describedby). */
  readonly hasHelper: boolean;
  /**
   * Whether an error message is present. The error is only referenced when the
   * field is BOTH invalid and has a message — an empty error region is never
   * pointed at, which would send a reader to nothing.
   */
  readonly hasError: boolean;
}

/** The stable ids of a field's parts, derived from the control id. */
export interface FieldPartIds {
  readonly control: string;
  readonly label: string;
  readonly helper: string;
  readonly error: string;
}

/** The resolved ARIA attribute set to apply to the native control. */
export interface FieldControlAria {
  /** Space-joined describedby ids, or `undefined` when nothing describes the field. */
  readonly 'aria-describedby': string | undefined;
  /** `"true"` only when invalid + has a message, else `undefined`. */
  readonly 'aria-invalid': 'true' | undefined;
  /** The error region id, set only when invalid + has a message. */
  readonly 'aria-errormessage': string | undefined;
  /** `"true"` when required, else `undefined`. */
  readonly 'aria-required': 'true' | undefined;
}

/** Derive the stable part ids for a field from its control id. */
export function fieldPartIds(id: string): FieldPartIds {
  return {
    control: id,
    label: `${id}-label`,
    helper: `${id}-helper`,
    error: `${id}-error`,
  };
}

/**
 * Whether the error region should be ANNOUNCED and REFERENCED. True only when the
 * field is invalid AND carries an error message — the single condition under which
 * `aria-invalid`, `aria-errormessage`, and the error id in `aria-describedby` are
 * all set. Below this bar the field is described by its helper only.
 */
export function fieldErrorIsActive(input: Pick<FieldA11yInput, 'invalid' | 'hasError'>): boolean {
  return input.invalid && input.hasError;
}

/**
 * Compute the native control's ARIA attribute set from the field state. Undefined
 * values mean "do not set the attribute" — the caller omits them rather than
 * emitting an empty string (an empty `aria-describedby` is not the same as none).
 */
export function fieldControlAria(input: FieldA11yInput): FieldControlAria {
  const ids = fieldPartIds(input.id);
  const errorActive = fieldErrorIsActive(input);

  // Reading order: the description first, then the error (when active). Only ids
  // whose regions actually exist are listed — never a dangling reference.
  const describedBy: string[] = [];
  if (input.hasHelper) describedBy.push(ids.helper);
  if (errorActive) describedBy.push(ids.error);

  return {
    'aria-describedby': describedBy.length > 0 ? describedBy.join(' ') : undefined,
    'aria-invalid': errorActive ? 'true' : undefined,
    'aria-errormessage': errorActive ? ids.error : undefined,
    'aria-required': input.required ? 'true' : undefined,
  };
}
