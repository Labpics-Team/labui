/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/number-input';
import type { LabNumberInput } from '@labpics/ui-core/number-input';

/** SSR-пропы <lab-number-input> (атрибуты/свойства), взяты из класса ядра (LabNumberInput). */
export type NumberInputSsrProps = Partial<Pick<LabNumberInput, 'type' | 'size' | 'label' | 'labelHidden' | 'helper' | 'error' | 'value' | 'defaultValue' | 'placeholder' | 'min' | 'max' | 'step' | 'scrubber' | 'allowMouseWheel' | 'readonly' | 'disabled' | 'required' | 'invalid' | 'name'>>;
/** SSR-слоты <lab-number-input> — предрендеренные строки контента. */
export type NumberInputSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-number-input> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderNumberInput(
  props: NumberInputSsrProps = {},
): string {
  return renderToString(html`<lab-number-input
      type=${ifDefined(props.type)}
      size=${ifDefined(props.size)}
      label=${ifDefined(props.label)}
      ?label-hidden=${Boolean(props.labelHidden)}
      helper=${ifDefined(props.helper)}
      error=${ifDefined(props.error)}
      value=${ifDefined(props.value)}
      default-value=${ifDefined(props.defaultValue)}
      placeholder=${ifDefined(props.placeholder)}
      min=${ifDefined(props.min)}
      max=${ifDefined(props.max)}
      step=${ifDefined(props.step)}
      ?scrubber=${Boolean(props.scrubber)}
      ?allow-mouse-wheel=${Boolean(props.allowMouseWheel)}
      ?readonly=${Boolean(props.readonly)}
      ?disabled=${Boolean(props.disabled)}
      ?required=${Boolean(props.required)}
      ?invalid=${Boolean(props.invalid)}
      name=${ifDefined(props.name)}
    ></lab-number-input>`);
}
