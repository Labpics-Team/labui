/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange, unsafeHTML } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/alert-dialog';
import type { LabAlertDialog } from '@labpics/ui-core/alert-dialog';

/** SSR-пропы <lab-alert-dialog> (атрибуты/свойства), взяты из класса ядра (LabAlertDialog). */
export type AlertDialogSsrProps = Partial<Pick<LabAlertDialog, 'modal' | 'closable' | 'heading' | 'description' | 'size'>>;
/** SSR-слоты <lab-alert-dialog> — предрендеренные строки контента. */
export type AlertDialogSsrSlots = { default?: string; content?: string };

/**
 * Рендерит <lab-alert-dialog> со стилями и Declarative Shadow DOM. Включите строку в
 * серверный ответ через v-html / {@html} / set:html либо серверный HTML-шаблон.
 * Обычная клиентская вставка innerHTML не создаёт declarative shadow root.
 */
export function renderAlertDialog(
  props: AlertDialogSsrProps = {},
  slots: AlertDialogSsrSlots = {},
): string {
  return renderToString(html`<lab-alert-dialog
      modal=${ifDefined(props.modal)}
      .closable=${props.closable === undefined ? noChange : Boolean(props.closable)}
      heading=${ifDefined(props.heading)}
      description=${ifDefined(props.description)}
      size=${ifDefined(props.size)}
    >${slots.content ? html`<span slot="content">${unsafeHTML(slots.content)}</span>` : ''}${unsafeHTML(slots.default ?? '')}</lab-alert-dialog>`);
}
