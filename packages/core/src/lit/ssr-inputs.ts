/** Explicit server inputs which HTML attribute presence cannot represent. */
export const SSR_INPUTS_ATTRIBUTE = 'data-lab-inputs';
/** Shared by the ESM and CJS constructors in the same custom-element registry. */
export const LAB_ELEMENT_BRAND: unique symbol = Symbol.for('@labpics/ui-core/LabElement');

export function parseSsrInputs(raw: string | null): Record<string, unknown> {
  if (raw === null) return {};
  try {
    const value: unknown = JSON.parse(raw);
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
