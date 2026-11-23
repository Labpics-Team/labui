/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/color-picker';
import type { LabColorPicker } from '@labpics/ui-core/color-picker';

/** SSR-пропы <lab-color-picker> (атрибуты/свойства), взяты из класса ядра (LabColorPicker). */
export type ColorPickerSsrProps = Partial<Pick<LabColorPicker, 'value' | 'defaultValue' | 'variant' | 'model' | 'defaultVariant' | 'defaultModel' | 'label' | 'name' | 'form' | 'disabled' | 'readonly' | 'required' | 'pickScreenColor'>> & { 'aria-label'?: string };
/** SSR-слоты <lab-color-picker> — предрендеренные строки контента. */
export type ColorPickerSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-color-picker> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderColorPicker(
  props: ColorPickerSsrProps = {},
): string {
  return renderToString(html`<lab-color-picker
      .value=${props.value === undefined ? noChange : props.value}
      .defaultValue=${props.defaultValue === undefined ? noChange : props.defaultValue}
      variant=${ifDefined(props.variant)}
      model=${ifDefined(props.model)}
      default-variant=${ifDefined(props.defaultVariant)}
      default-model=${ifDefined(props.defaultModel)}
      label=${ifDefined(props.label)}
      name=${ifDefined(props.name)}
      form=${ifDefined(props.form)}
      .disabled=${props.disabled === undefined ? noChange : props.disabled}
      .readonly=${props.readonly === undefined ? noChange : props.readonly}
      .required=${props.required === undefined ? noChange : props.required}
      .pickScreenColor=${props.pickScreenColor === undefined ? noChange : props.pickScreenColor}
      aria-label=${ifDefined(props['aria-label'])}
    ></lab-color-picker>`);
}
