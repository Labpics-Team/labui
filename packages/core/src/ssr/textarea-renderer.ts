import { type ThunkedRenderResult, collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import type { RenderInfo } from '@lit-labs/ssr/lib/render-value.js';
import { normalizeTextareaValue } from '../components/textarea/runtime.js';
import { LabElementRenderer } from './lab-element-renderer.js';

/**
 * Lit SSR 4.1 does not serialize textarea.value (lit/lit#4915). Keep the client
 * template and its hydration markers stable; supply only the native initial text.
 * Dynamic static-html templates would cache user values and replace the control.
 */
export class TextareaElementRenderer extends LabElementRenderer {
  static override matchesClass(ctor: typeof HTMLElement, tagName?: string): boolean {
    return tagName === 'lab-textarea' && LabElementRenderer.matchesClass(ctor);
  }

  override renderShadow(renderInfo: RenderInfo): ThunkedRenderResult | undefined {
    const result = super.renderShadow(renderInfo);
    if (!result) return result;
    return [
      () => {
        const output = collectResultSync(result);
        // Match textarea.value and HTML input preprocessing before protecting
        // the first LF: CRLF and CR are normalized before the parser strips it.
        const value = normalizeTextareaValue(
          String((this.element as unknown as { value: string }).value ?? ''),
        );
        // This component contains exactly one empty native textarea. If upstream
        // starts rendering its value, fail rather than silently doubling content.
        const closing = output.indexOf('></textarea>');
        if (closing === -1 || output.indexOf('></textarea>', closing + 1) !== -1)
          throw new Error('Textarea SSR expected one empty native textarea');
        const escaped = value
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;');
        // The HTML parser discards the first newline immediately after <textarea>.
        const initial = (value.startsWith('\n') ? '\n' : '') + escaped;
        return `${output.slice(0, closing + 1)}${initial}${output.slice(closing + 1)}`;
      },
    ];
  }
}
