/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/slider';
import type { LabSlider } from '@labpics/ui-core/slider';

/** SSR-пропы <lab-slider> (атрибуты/свойства), взяты из класса ядра (LabSlider). */
export type SliderSsrProps = Partial<Pick<LabSlider, 'size' | 'orientation' | 'label' | 'labelHidden' | 'helper' | 'error' | 'value' | 'defaultValue' | 'min' | 'max' | 'step' | 'marks' | 'showValue' | 'readonly' | 'disabled' | 'invalid' | 'name'>>;
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
      size=${ifDefined(props.size)}
      orientation=${ifDefined(props.orientation)}
      label=${ifDefined(props.label)}
      ?label-hidden=${Boolean(props.labelHidden)}
      helper=${ifDefined(props.helper)}
      error=${ifDefined(props.error)}
      .value=${props.value}
      .defaultValue=${props.defaultValue}
      min=${ifDefined(props.min)}
      max=${ifDefined(props.max)}
      step=${ifDefined(props.step)}
      .marks=${props.marks}
      ?show-value=${Boolean(props.showValue)}
      ?readonly=${Boolean(props.readonly)}
      ?disabled=${Boolean(props.disabled)}
      ?invalid=${Boolean(props.invalid)}
      name=${ifDefined(props.name)}
    ></lab-slider>`);
}
