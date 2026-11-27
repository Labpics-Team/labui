/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange, unsafeHTML } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/checkbox';
import type { LabCheckbox } from '@labpics/ui-core/checkbox';

/** SSR-пропы <lab-checkbox> (атрибуты/свойства), взяты из класса ядра (LabCheckbox). */
export type CheckboxSsrProps = Partial<Pick<LabCheckbox, 'type' | 'size' | 'variant' | 'checked' | 'indeterminate' | 'defaultChecked' | 'defaultIndeterminate' | 'controlled' | 'disabled' | 'required' | 'name' | 'value'>> & { 'aria-label'?: string; 'form'?: string };
/** SSR-слоты <lab-checkbox> — предрендеренные строки контента. */
export type CheckboxSsrSlots = { default?: string; description?: string; icon?: string; labelStart?: string };

/**
 * Рендерит <lab-checkbox> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderCheckbox(
  props: CheckboxSsrProps = {},
  slots: CheckboxSsrSlots = {},
): string {
  return renderToString(html`<lab-checkbox
      type=${ifDefined(props.type)}
      size=${ifDefined(props.size)}
      variant=${ifDefined(props.variant)}
      .checked=${props.checked === undefined ? noChange : props.checked}
      .indeterminate=${props.indeterminate === undefined ? noChange : props.indeterminate}
      .defaultChecked=${props.defaultChecked === undefined ? noChange : props.defaultChecked}
      .defaultIndeterminate=${props.defaultIndeterminate === undefined ? noChange : props.defaultIndeterminate}
      .controlled=${props.controlled === undefined ? noChange : props.controlled}
      .disabled=${props.disabled === undefined ? noChange : props.disabled}
      .required=${props.required === undefined ? noChange : props.required}
      name=${ifDefined(props.name)}
      value=${ifDefined(props.value)}
      aria-label=${ifDefined(props['aria-label'])}
      form=${ifDefined(props['form'])}
    >${slots.description ? html`<span slot="description">${unsafeHTML(slots.description)}</span>` : ''}${slots.icon ? html`<span slot="icon">${unsafeHTML(slots.icon)}</span>` : ''}${slots.labelStart ? html`<span slot="label-start">${unsafeHTML(slots.labelStart)}</span>` : ''}${unsafeHTML(slots.default ?? '')}</lab-checkbox>`);
}
