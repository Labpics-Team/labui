/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, unsafeHTML } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/alert-dialog';
import type { LabAlertDialog } from '@labpics/ui-core/alert-dialog';

/** SSR-пропы <lab-alert-dialog> (атрибуты/свойства), взяты из класса ядра (LabAlertDialog). */
export type AlertDialogSsrProps = Partial<Pick<LabAlertDialog, 'size' | 'modal' | 'closable' | 'heading' | 'description'>>;
/** SSR-слоты <lab-alert-dialog> — предрендеренные строки контента. */
export type AlertDialogSsrSlots = { default?: string; content?: string };

/**
 * Рендерит <lab-alert-dialog> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderAlertDialog(
  props: AlertDialogSsrProps = {},
  slots: AlertDialogSsrSlots = {},
): string {
  return renderToString(html`<lab-alert-dialog
      size=${ifDefined(props.size)}
      modal=${ifDefined(props.modal)}
      ?closable=${Boolean(props.closable)}
      heading=${ifDefined(props.heading)}
      description=${ifDefined(props.description)}
    >${slots.content ? html`<span slot="content">${unsafeHTML(slots.content)}</span>` : ''}${unsafeHTML(slots.default ?? '')}</lab-alert-dialog>`);
}
