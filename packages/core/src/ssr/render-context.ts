import './environment.js';
import { LitElementRenderer } from '@lit-labs/ssr';
import type { RenderInfo } from '@lit-labs/ssr/lib/render-value.js';
import { LabElementRenderer } from './lab-element-renderer.js';
import { TextareaElementRenderer } from './textarea-renderer.js';

const elementRenderers = [TextareaElementRenderer, LabElementRenderer, LitElementRenderer];

/** The template and framework renderers share the same element specializations. */
export function createRenderContext(): RenderInfo {
  return {
    elementRenderers,
    customElementInstanceStack: [],
    customElementHostStack: [],
    eventTargetStack: [],
    slotStack: [],
    deferHydration: false,
  };
}
