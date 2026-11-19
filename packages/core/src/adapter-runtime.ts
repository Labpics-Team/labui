/** How a declared custom-element input crosses an adapter boundary. */
export type LabPropKind = 'boolean' | 'prop' | 'string';
export interface LabPropSpec {
  readonly name: string;
  readonly attr: string;
  readonly kind: LabPropKind;
}

const forwarded = new WeakMap<HTMLElement, Map<string, unknown>>();

/**
 * Apply only caller input changes. An omitted input does not own the element's
 * constructor default or reflected state. Withdrawing an attribute input removes
 * it once; withdrawing a JS-property input releases control of its current value.
 * Explicit null/false/empty values still reach the element.
 */
export function forwardDeclared(
  element: HTMLElement | undefined,
  specs: readonly LabPropSpec[],
  values: Record<string, unknown>,
): void {
  if (!element) return;
  let previous = forwarded.get(element);
  const initial = previous === undefined;
  if (!previous) {
    previous = new Map();
    forwarded.set(element, previous);
  }
  for (const spec of specs) {
    const value = values[spec.name];
    if (Object.is(previous.get(spec.name), value)) continue;
    if (value === undefined) previous.delete(spec.name);
    else previous.set(spec.name, value);
    if (spec.kind === 'prop') {
      if (value !== undefined) (element as unknown as Record<string, unknown>)[spec.name] = value;
    } else if (spec.kind === 'boolean') {
      if (value === undefined) element.removeAttribute(spec.attr);
      // Reflection is asynchronous: removing an as-yet absent attribute cannot
      // cancel a true property set earlier in the same update. Withdraw a flag
      // through its property too; initial/repeated omission is skipped above.
      Reflect.set(element, spec.name, value === undefined ? false : value);
    } else if (value === undefined || value === null) {
      element.removeAttribute(spec.attr);
    } else {
      // Hydration adopts an existing attribute. Writing the same initial value
      // again fires attributeChangedCallback and can undo a control's recovery
      // of input typed before JS. Later caller changes must still reach it.
      if (initial && element.getAttribute(spec.attr) === String(value)) continue;
      element.setAttribute(spec.attr, String(value));
    }
  }
}
