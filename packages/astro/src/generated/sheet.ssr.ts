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
export type SheetSsrProps = Partial<Pick<LabSheet, 'modal' | 'closable' | 'heading' | 'description' | 'open' | 'position'>>;
/** SSR-слоты <lab-sheet> — предрендеренные строки контента. */
export type SheetSsrSlots = { default?: string; content?: string };

/**
 * Рендерит <lab-sheet> со стилями и Declarative Shadow DOM. Включите строку в
 * серверный ответ через v-html / {@html} / set:html либо серверный HTML-шаблон.
 * Обычная клиентская вставка innerHTML не создаёт declarative shadow root.
 */
export function renderSheet(
  props: SheetSsrProps = {},
  slots: SheetSsrSlots = {},
): string {
  return renderToString(html`<lab-sheet
      modal=${ifDefined(props.modal)}
      .closable=${props.closable === undefined ? noChange : Boolean(props.closable)}
      heading=${ifDefined(props.heading)}
      description=${ifDefined(props.description)}
      .open=${props.open === undefined ? noChange : Boolean(props.open)}
      .position=${props.position === undefined ? noChange : props.position}
    >${slots.content ? html`<span slot="content">${unsafeHTML(slots.content)}</span>` : ''}${unsafeHTML(slots.default ?? '')}</lab-sheet>`);
}
