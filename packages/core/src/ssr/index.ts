/**
 * Серверный вход ядра: Lit-шаблон становится HTML со стилями и Declarative
 * Shadow DOM. Адаптер включает строку в серверный ответ; клиентская вставка
 * через innerHTML сама по себе не создаёт declarative shadow root.
 *
 * Вход изолирует optional peer @lit-labs/ssr от клиентских компонентов.
 * Штатный Lit renderer владеет reflection, HTML escaping и shadow DOM;
 * расширение переносит итоговые публичные Boolean между экземплярами.
 *
 * Node-вход Lit сам предоставляет минимальный DOM и сохраняет общий registry.
 * Дополнительный глобальный установщик заменил бы API хоста, включая fetch.
 */
import { LitElementRenderer, render } from '@lit-labs/ssr';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import { type LitElement, type TemplateResult, html, noChange } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { booleanSnapshotAttribute, serializeBooleanSnapshot } from '../lit/boolean-snapshot.js';

class LabElementRenderer extends LitElementRenderer {
  static override matchesClass(ctor: typeof HTMLElement): boolean {
    // Наличие нашего decoder — capability, общая также для ESM/CJS entrypoints.
    return (
      LitElementRenderer.matchesClass(ctor) &&
      (ctor as typeof LitElement).observedAttributes.includes(booleanSnapshotAttribute)
    );
  }

  override renderAttributes(): ReturnType<LitElementRenderer['renderAttributes']> {
    if (this.element.hasAttribute(booleanSnapshotAttribute)) {
      throw new TypeError(`LabUI SSR: ${booleanSnapshotAttribute} is reserved for core.`);
    }
    // Lit уже вызвал willUpdate и reflection. Новый атрибут идёт последним;
    // штатный renderer сохраняет HTML escaping и declarative shadow DOM.
    const snapshot = serializeBooleanSnapshot(this.element);
    if (snapshot !== undefined) this.element.setAttribute(booleanSnapshotAttribute, snapshot);
    return super.renderAttributes();
  }
}

/**
 * Render a Lit template to a declarative-shadow-DOM HTML string.
 *
 * The caller is responsible for having imported the element module(s) the
 * template uses so they are registered. Returns a complete HTML string ready
 * to embed via any framework's raw-HTML slot.
 */
export function renderToString(template: TemplateResult): string {
  return collectResultSync(
    render(template, { elementRenderers: [LabElementRenderer, LitElementRenderer] }),
  );
}

/**
 * Re-exported so SSR callers can author templates without a direct `lit`
 * dependency — the SSR entry is the one place a non-Lit host touches Lit at all.
 * ifDefined пропускает отсутствующий атрибут, noChange сохраняет значение
 * незаданного свойства, unsafeHTML вставляет готовый слот. Адаптеры берут эти
 * операции через одну SSR-поверхность и не зависят от Lit напрямую.
 */
export { html, ifDefined, noChange, unsafeHTML };
export type { TemplateResult };
