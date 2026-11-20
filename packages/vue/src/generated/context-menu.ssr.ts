/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange, unsafeHTML } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/context-menu';
import type { LabContextMenu } from '@labpics/ui-core/context-menu';

/** SSR-пропы <lab-context-menu> (атрибуты/свойства), взяты из класса ядра (LabContextMenu). */
export type ContextMenuSsrProps = Partial<Pick<LabContextMenu, 'label' | 'placement' | 'disabled' | 'checkedValues' | 'defaultCheckedValues' | 'heading' | 'items' | 'open' | 'defaultOpen'>> & { 'aria-label'?: string; 'form'?: string };
/** SSR-слоты <lab-context-menu> — предрендеренные строки контента. */
export type ContextMenuSsrSlots = { default?: string };

/**
 * Рендерит <lab-context-menu> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderContextMenu(
  props: ContextMenuSsrProps = {},
  slots: ContextMenuSsrSlots = {},
): string {
  return renderToString(html`<lab-context-menu
      label=${ifDefined(props.label)}
      placement=${ifDefined(props.placement)}
      .disabled=${props.disabled === undefined ? noChange : props.disabled}
      .checkedValues=${props.checkedValues === undefined ? noChange : props.checkedValues}
      .defaultCheckedValues=${props.defaultCheckedValues === undefined ? noChange : props.defaultCheckedValues}
      heading=${ifDefined(props.heading)}
      .items=${props.items === undefined ? noChange : props.items}
      .open=${props.open === undefined ? noChange : props.open}
      .defaultOpen=${props.defaultOpen === undefined ? noChange : props.defaultOpen}
      aria-label=${ifDefined(props['aria-label'])}
      form=${ifDefined(props['form'])}
    >${unsafeHTML(slots.default ?? '')}</lab-context-menu>`);
}
