/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange, unsafeHTML } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/sheet';
import type { LabSheet } from '@labpics/ui-core/sheet';

/** SSR-пропы <lab-sheet> (атрибуты/свойства), взяты из класса ядра (LabSheet). */
export type SheetSsrProps = Partial<Pick<LabSheet, 'open' | 'position' | 'modal' | 'closable' | 'heading' | 'description'>>;
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
      ?open=${Boolean(props.open)}
      position=${ifDefined(props.position)}
      .modal=${props.modal === undefined ? noChange : props.modal}
      ?closable=${Boolean(props.closable)}
      heading=${ifDefined(props.heading)}
      description=${ifDefined(props.description)}
    >${slots.content ? html`<span slot="content">${unsafeHTML(slots.content)}</span>` : ''}${slots.trigger ? html`<span slot="trigger">${unsafeHTML(slots.trigger)}</span>` : ''}${unsafeHTML(slots.default ?? '')}</lab-sheet>`);
}
