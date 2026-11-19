import type { ElementSsrInputs, RenderedElementParts } from './element-types.js';
export type { ElementSsrInputs, RenderedElementParts } from './element-types.js';

/** Browser export: the parser has already moved DSD out of the light DOM. */
export function renderElementParts(
  _tag: string,
  _inputs: ElementSsrInputs,
): RenderedElementParts | undefined {
  return undefined;
}
