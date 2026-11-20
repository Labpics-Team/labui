/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange, unsafeHTML, slotProjectionShadowHtml } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/sheet';
import type { LabSheet } from '@labpics/ui-core/sheet';

/** SSR-пропы <lab-sheet> (атрибуты/свойства), взяты из класса ядра (LabSheet). */
export type SheetSsrProps = Partial<Pick<LabSheet, 'open' | 'position' | 'modal' | 'closable' | 'heading' | 'description'>> & { 'aria-label'?: string; 'form'?: string };
/** SSR-слоты <lab-sheet> — предрендеренные строки контента. */
export type SheetSsrSlots = { default?: string; content?: string; trigger?: string };

/**
 * Рендерит <lab-sheet> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderSheet(
  props: SheetSsrProps = {},
  slots: SheetSsrSlots = {},
): string {
  return renderToString(html`<lab-sheet
      .open=${props.open === undefined ? noChange : props.open}
      position=${ifDefined(props.position)}
      .modal=${props.modal === undefined ? noChange : props.modal}
      .closable=${props.closable === undefined ? noChange : props.closable}
      heading=${ifDefined(props.heading)}
      description=${ifDefined(props.description)}
      aria-label=${ifDefined(props['aria-label'])}
      form=${ifDefined(props['form'])}
    >${slots.content ? html`<lab-slot slot="content">${unsafeHTML(slotProjectionShadowHtml)}${unsafeHTML(slots.content)}</lab-slot>` : ''}${slots.trigger ? html`<lab-slot slot="trigger">${unsafeHTML(slotProjectionShadowHtml)}${unsafeHTML(slots.trigger)}</lab-slot>` : ''}${unsafeHTML(slots.default ?? '')}</lab-sheet>`);
}
