/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange, unsafeHTML, slotProjectionShadowHtml } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/button';
import type { LabButton } from '@labpics/ui-core/button';

/** SSR-пропы <lab-button> (атрибуты/свойства), взяты из класса ядра (LabButton). */
export type ButtonSsrProps = Partial<Pick<LabButton, 'type' | 'kind' | 'size' | 'icon' | 'loading' | 'disabled' | 'htmlType'>> & { 'aria-label'?: string; 'form'?: string };
/** SSR-слоты <lab-button> — предрендеренные строки контента. */
export type ButtonSsrSlots = { default?: string; description?: string; icon?: string; iconEnd?: string };

/**
 * Рендерит <lab-button> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderButton(
  props: ButtonSsrProps = {},
  slots: ButtonSsrSlots = {},
): string {
  return renderToString(html`<lab-button
      type=${ifDefined(props.type)}
      kind=${ifDefined(props.kind)}
      size=${ifDefined(props.size)}
      .icon=${props.icon === undefined ? noChange : props.icon}
      .loading=${props.loading === undefined ? noChange : props.loading}
      .disabled=${props.disabled === undefined ? noChange : props.disabled}
      html-type=${ifDefined(props.htmlType)}
      aria-label=${ifDefined(props['aria-label'])}
      form=${ifDefined(props['form'])}
    >${slots.description ? html`<lab-slot slot="description">${unsafeHTML(slotProjectionShadowHtml)}${unsafeHTML(slots.description)}</lab-slot>` : ''}${slots.icon ? html`<lab-slot slot="icon">${unsafeHTML(slotProjectionShadowHtml)}${unsafeHTML(slots.icon)}</lab-slot>` : ''}${slots.iconEnd ? html`<lab-slot slot="icon-end">${unsafeHTML(slotProjectionShadowHtml)}${unsafeHTML(slots.iconEnd)}</lab-slot>` : ''}${unsafeHTML(slots.default ?? '')}</lab-button>`);
}
