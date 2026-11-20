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
export type DialogSsrProps = Partial<Pick<LabDialog, 'open' | 'controlled' | 'size' | 'modal' | 'closable' | 'heading' | 'description' | 'closeLabel'>> & { 'aria-label'?: string; 'form'?: string };
/** SSR-слоты <lab-dialog> — предрендеренные строки контента. */
export type DialogSsrSlots = { default?: string; actions?: string; content?: string; trigger?: string };

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
      .open=${props.open === undefined ? noChange : props.open}
      .controlled=${props.controlled === undefined ? noChange : props.controlled}
      size=${ifDefined(props.size)}
      .modal=${props.modal === undefined ? noChange : props.modal}
      .closable=${props.closable === undefined ? noChange : props.closable}
      heading=${ifDefined(props.heading)}
      description=${ifDefined(props.description)}
      close-label=${ifDefined(props.closeLabel)}
      aria-label=${ifDefined(props['aria-label'])}
      form=${ifDefined(props['form'])}
    >${slots.actions ? html`<lab-slot slot="actions">${unsafeHTML(slotProjectionShadowHtml)}${unsafeHTML(slots.actions)}</lab-slot>` : ''}${slots.content ? html`<lab-slot slot="content">${unsafeHTML(slotProjectionShadowHtml)}${unsafeHTML(slots.content)}</lab-slot>` : ''}${slots.trigger ? html`<lab-slot slot="trigger">${unsafeHTML(slotProjectionShadowHtml)}${unsafeHTML(slots.trigger)}</lab-slot>` : ''}${unsafeHTML(slots.default ?? '')}</lab-dialog>`);
}
