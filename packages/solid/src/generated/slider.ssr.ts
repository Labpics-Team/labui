/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/slider';
import type { LabSlider } from '@labpics/ui-core/slider';

/** SSR-пропы <lab-slider> (атрибуты/свойства), взяты из класса ядра (LabSlider). */
export type SliderSsrProps = Partial<Pick<LabSlider, 'variant' | 'orientation' | 'size' | 'label' | 'labelHidden' | 'helper' | 'error' | 'name' | 'form' | 'value' | 'defaultValue' | 'min' | 'max' | 'step' | 'showValue' | 'readonly' | 'disabled' | 'invalid' | 'thumbLabels'>> & { 'aria-label'?: string };
/** SSR-слоты <lab-slider> — предрендеренные строки контента. */
export type SliderSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-slider> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderSlider(
  props: SliderSsrProps = {},
): string {
  return renderToString(html`<lab-slider
      variant=${ifDefined(props.variant)}
      orientation=${ifDefined(props.orientation)}
      size=${ifDefined(props.size)}
      label=${ifDefined(props.label)}
      .labelHidden=${props.labelHidden === undefined ? noChange : props.labelHidden}
      helper=${ifDefined(props.helper)}
      error=${ifDefined(props.error)}
      name=${ifDefined(props.name)}
      form=${ifDefined(props.form)}
      .value=${props.value === undefined ? noChange : props.value}
      .defaultValue=${props.defaultValue === undefined ? noChange : props.defaultValue}
      min=${ifDefined(props.min)}
      max=${ifDefined(props.max)}
      step=${ifDefined(props.step)}
      .showValue=${props.showValue === undefined ? noChange : props.showValue}
      .readonly=${props.readonly === undefined ? noChange : props.readonly}
      .disabled=${props.disabled === undefined ? noChange : props.disabled}
      .invalid=${props.invalid === undefined ? noChange : props.invalid}
      .thumbLabels=${props.thumbLabels === undefined ? noChange : props.thumbLabels}
      aria-label=${ifDefined(props['aria-label'])}
    ></lab-slider>`);
}
