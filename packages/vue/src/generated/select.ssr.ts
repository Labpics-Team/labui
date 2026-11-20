/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange, unsafeHTML, slotProjectionShadowHtml } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/select';
import type { LabSelect } from '@labpics/ui-core/select';

/** SSR-пропы <lab-select> (атрибуты/свойства), взяты из класса ядра (LabSelect). */
export type SelectSsrProps = Partial<Pick<LabSelect, 'size' | 'placement' | 'multiple' | 'disabled' | 'name' | 'required' | 'showLabel' | 'removeLabel' | 'placeholder' | 'label' | 'value' | 'defaultValue' | 'items'>> & { 'aria-label'?: string; 'form'?: string };
/** SSR-слоты <lab-select> — предрендеренные строки контента. */
export type SelectSsrSlots = { leading?: string };

/**
 * Рендерит <lab-select> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderSelect(
  props: SelectSsrProps = {},
  slots: SelectSsrSlots = {},
): string {
  return renderToString(html`<lab-select
      size=${ifDefined(props.size)}
      placement=${ifDefined(props.placement)}
      .multiple=${props.multiple === undefined ? noChange : props.multiple}
      .disabled=${props.disabled === undefined ? noChange : props.disabled}
      name=${ifDefined(props.name)}
      .required=${props.required === undefined ? noChange : props.required}
      .showLabel=${props.showLabel === undefined ? noChange : props.showLabel}
      remove-label=${ifDefined(props.removeLabel)}
      placeholder=${ifDefined(props.placeholder)}
      label=${ifDefined(props.label)}
      .value=${props.value === undefined ? noChange : props.value}
      .defaultValue=${props.defaultValue === undefined ? noChange : props.defaultValue}
      .items=${props.items === undefined ? noChange : props.items}
      aria-label=${ifDefined(props['aria-label'])}
      form=${ifDefined(props['form'])}
    >${slots.leading ? html`<lab-slot slot="leading">${unsafeHTML(slotProjectionShadowHtml)}${unsafeHTML(slots.leading)}</lab-slot>` : ''}</lab-select>`);
}
