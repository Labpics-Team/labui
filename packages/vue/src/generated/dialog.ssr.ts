/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange, unsafeHTML, projectSingleSlot } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/dialog';
import type { LabDialog } from '@labpics/ui-core/dialog';

/** SSR-пропы <lab-dialog> (атрибуты/свойства), взяты из класса ядра (LabDialog). */
export type DialogSsrProps = Partial<Pick<LabDialog, 'modal' | 'closable' | 'heading' | 'description' | 'size'>>;
/** SSR-слоты <lab-dialog> — предрендеренные строки контента. */
export type DialogSsrSlots = { default?: string; content?: string; trigger?: string };

/**
 * Рендерит <lab-dialog> со стилями и Declarative Shadow DOM. Включите строку в
 * серверный ответ через v-html / {@html} / set:html либо серверный HTML-шаблон.
 * Обычная клиентская вставка innerHTML не создаёт declarative shadow root.
 */
export function renderDialog(
  props: DialogSsrProps = {},
  slots: DialogSsrSlots = {},
): string {
  return renderToString(html`<lab-dialog
      modal=${ifDefined(props.modal)}
      .closable=${props.closable === undefined ? noChange : Boolean(props.closable)}
      heading=${ifDefined(props.heading)}
      description=${ifDefined(props.description)}
      size=${ifDefined(props.size)}
    >${slots.content ? html`<span slot="content">${unsafeHTML(slots.content)}</span>` : ''}${unsafeHTML(projectSingleSlot(slots.trigger, 'trigger'))}${unsafeHTML(slots.default ?? '')}</lab-dialog>`);
}
