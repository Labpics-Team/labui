import { LitElementRenderer } from '@lit-labs/ssr';
import type { LabElement } from '../lit/lab-element.js';
import type { LabPropertyDeclaration } from '../lit/property.js';
import { LAB_ELEMENT_BRAND, SSR_INPUTS_ATTRIBUTE } from '../lit/ssr-inputs.js';

function isJsonValue(value: unknown, parents = new Set<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || parents.has(value)) return false;
  if (
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  )
    return false;
  parents.add(value);
  const valid = (Array.isArray(value) ? value : Object.values(value)).every(
    (item) =>
      // JSON omits undefined optional object members, as the SSR prop contract does.
      (!Array.isArray(value) && item === undefined) || isJsonValue(item, parents),
  );
  parents.delete(value);
  return valid;
}

/** Preserve caller inputs without serializing controllers or mutable element state. */
export class LabElementRenderer extends LitElementRenderer {
  private readonly inputs: Record<string, unknown> = Object.create(null);

  static override matchesClass(ctor: typeof HTMLElement): boolean {
    return Reflect.get(ctor, LAB_ELEMENT_BRAND) === true;
  }

  override setProperty(name: string, value: unknown): void {
    super.setProperty(name, value);
    const options = (this.element.constructor as typeof LabElement).elementProperties.get(name) as
      | LabPropertyDeclaration
      | undefined;
    if (!options || options.state || options.resource || value === undefined) return;
    // An existing reflected attribute remains the authority for its input.
    // Absent boolean/null attributes cannot distinguish an explicit input from
    // a constructor default, so those values still need the server record.
    if (options.reflect && options.attribute !== false && value !== false && value !== null) return;
    if (!isJsonValue(value))
      throw new TypeError(`${this.tagName}.${name} is not a JSON-serializable SSR input`);
    this.inputs[name] = value;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (Object.keys(this.inputs).length)
      this.element.setAttribute(SSR_INPUTS_ATTRIBUTE, JSON.stringify(this.inputs));
  }
}
