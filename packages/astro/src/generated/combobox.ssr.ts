/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/combobox';
import type { LabCombobox } from '@labpics/ui-core/combobox';

/** SSR-пропы <lab-combobox> (атрибуты/свойства), взяты из класса ядра (LabCombobox). */
export type ComboboxSsrProps = Partial<Pick<LabCombobox, 'type' | 'size' | 'placement' | 'multiple' | 'disabled' | 'readonly' | 'required' | 'invalid' | 'name' | 'placeholder' | 'label' | 'labelHidden' | 'helper' | 'error' | 'value' | 'defaultValue' | 'items'>>;
/** SSR-слоты <lab-combobox> — предрендеренные строки контента. */
export type ComboboxSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-combobox> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderCombobox(
  props: ComboboxSsrProps = {},
): string {
  return renderToString(html`<lab-combobox
      type=${ifDefined(props.type)}
      size=${ifDefined(props.size)}
      placement=${ifDefined(props.placement)}
      ?multiple=${Boolean(props.multiple)}
      ?disabled=${Boolean(props.disabled)}
      ?readonly=${Boolean(props.readonly)}
      ?required=${Boolean(props.required)}
      ?invalid=${Boolean(props.invalid)}
      name=${ifDefined(props.name)}
      placeholder=${ifDefined(props.placeholder)}
      label=${ifDefined(props.label)}
      ?label-hidden=${Boolean(props.labelHidden)}
      helper=${ifDefined(props.helper)}
      error=${ifDefined(props.error)}
      .value=${props.value}
      .defaultValue=${props.defaultValue}
      .items=${props.items}
    ></lab-combobox>`);
}
