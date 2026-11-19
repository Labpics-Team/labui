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
export type PopoverSsrProps = Partial<Pick<LabPopover, 'placement' | 'size' | 'modal' | 'closable' | 'arrow' | 'heading' | 'description'>> & { 'aria-label'?: string; 'form'?: string };
/** SSR-слоты <lab-popover> — предрендеренные строки контента. */
export type PopoverSsrSlots = { default?: string; content?: string };

/**
 * Рендерит <lab-popover> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderPopover(
  props: PopoverSsrProps = {},
  slots: PopoverSsrSlots = {},
): string {
  return renderToString(html`<lab-popover
      placement=${ifDefined(props.placement)}
      size=${ifDefined(props.size)}
      .modal=${props.modal === undefined ? noChange : props.modal}
      .closable=${props.closable === undefined ? noChange : props.closable}
      .arrow=${props.arrow === undefined ? noChange : props.arrow}
      heading=${ifDefined(props.heading)}
      description=${ifDefined(props.description)}
      aria-label=${ifDefined(props['aria-label'])}
      form=${ifDefined(props['form'])}
    >${slots.content ? html`<span slot="content">${unsafeHTML(slots.content)}</span>` : ''}${unsafeHTML(slots.default ?? '')}</lab-popover>`);
}
