/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange, unsafeHTML } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/popover';
import type { LabPopover } from '@labpics/ui-core/popover';

/** SSR-пропы <lab-popover> (атрибуты/свойства), взяты из класса ядра (LabPopover). */
export type PopoverSsrProps = Partial<Pick<LabPopover, 'placement' | 'size' | 'modal' | 'closable' | 'arrow' | 'heading' | 'description'>>;
/** SSR-слоты <lab-popover> — предрендеренные строки контента. */
export type PopoverSsrSlots = { default?: string; content?: string };

/**
 * Рендерит <lab-popover> со стилями и Declarative Shadow DOM. Включите строку в
 * серверный ответ через v-html / {@html} / set:html либо серверный HTML-шаблон.
 * Обычная клиентская вставка innerHTML не создаёт declarative shadow root.
 */
export function renderPopover(
  props: PopoverSsrProps = {},
  slots: PopoverSsrSlots = {},
): string {
  return renderToString(html`<lab-popover
      placement=${ifDefined(props.placement)}
      size=${ifDefined(props.size)}
      .modal=${props.modal === undefined ? noChange : Boolean(props.modal)}
      .closable=${props.closable === undefined ? noChange : Boolean(props.closable)}
      .arrow=${props.arrow === undefined ? noChange : Boolean(props.arrow)}
      heading=${ifDefined(props.heading)}
      description=${ifDefined(props.description)}
    >${slots.content ? html`<span slot="content">${unsafeHTML(slots.content)}</span>` : ''}${unsafeHTML(slots.default ?? '')}</lab-popover>`);
}
