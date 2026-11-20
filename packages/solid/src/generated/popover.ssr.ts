/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange, unsafeHTML, slotProjectionShadowHtml } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/popover';
import type { LabPopover } from '@labpics/ui-core/popover';

/** SSR-пропы <lab-popover> (атрибуты/свойства), взяты из класса ядра (LabPopover). */
export type PopoverSsrProps = Partial<Pick<LabPopover, 'open' | 'controlled' | 'size' | 'modal' | 'closable' | 'heading' | 'description' | 'closeLabel' | 'placement' | 'arrow'>> & { 'aria-label'?: string; 'form'?: string };
/** SSR-слоты <lab-popover> — предрендеренные строки контента. */
export type PopoverSsrSlots = { default?: string; actions?: string; content?: string; trigger?: string };

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
      .open=${props.open === undefined ? noChange : props.open}
      .controlled=${props.controlled === undefined ? noChange : props.controlled}
      size=${ifDefined(props.size)}
      .modal=${props.modal === undefined ? noChange : props.modal}
      .closable=${props.closable === undefined ? noChange : props.closable}
      heading=${ifDefined(props.heading)}
      description=${ifDefined(props.description)}
      close-label=${ifDefined(props.closeLabel)}
      placement=${ifDefined(props.placement)}
      .arrow=${props.arrow === undefined ? noChange : props.arrow}
      aria-label=${ifDefined(props['aria-label'])}
      form=${ifDefined(props['form'])}
    >${slots.actions ? html`<lab-slot slot="actions">${unsafeHTML(slotProjectionShadowHtml)}${unsafeHTML(slots.actions)}</lab-slot>` : ''}${slots.content ? html`<lab-slot slot="content">${unsafeHTML(slotProjectionShadowHtml)}${unsafeHTML(slots.content)}</lab-slot>` : ''}${slots.trigger ? html`<lab-slot slot="trigger">${unsafeHTML(slotProjectionShadowHtml)}${unsafeHTML(slots.trigger)}</lab-slot>` : ''}${unsafeHTML(slots.default ?? '')}</lab-popover>`);
}
