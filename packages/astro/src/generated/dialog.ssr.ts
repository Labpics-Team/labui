/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange, unsafeHTML, slotProjectionShadowHtml } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/dialog';
import type { LabDialog } from '@labpics/ui-core/dialog';

/** SSR-пропы <lab-dialog> (атрибуты/свойства), взяты из класса ядра (LabDialog). */
export type DialogSsrProps = Partial<Pick<LabDialog, 'size' | 'modal' | 'closable' | 'heading' | 'description'>> & { 'aria-label'?: string; 'form'?: string };
/** SSR-слоты <lab-dialog> — предрендеренные строки контента. */
export type DialogSsrSlots = { default?: string; content?: string };

/**
 * Рендерит <lab-dialog> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderDialog(
  props: DialogSsrProps = {},
  slots: DialogSsrSlots = {},
): string {
  return renderToString(html`<lab-dialog
      size=${ifDefined(props.size)}
      modal=${ifDefined(props.modal)}
      .closable=${props.closable === undefined ? noChange : props.closable}
      heading=${ifDefined(props.heading)}
      description=${ifDefined(props.description)}
      aria-label=${ifDefined(props['aria-label'])}
      form=${ifDefined(props['form'])}
    >${slots.content ? html`<lab-slot slot="content">${unsafeHTML(slotProjectionShadowHtml)}${unsafeHTML(slots.content)}</lab-slot>` : ''}${unsafeHTML(slots.default ?? '')}</lab-dialog>`);
}
