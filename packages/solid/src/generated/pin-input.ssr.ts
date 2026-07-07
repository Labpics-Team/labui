/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/pin-input';
import type { LabPinInput } from '@labpics/ui-core/pin-input';

/** SSR-пропы <lab-pin-input> (атрибуты/свойства), взяты из класса ядра (LabPinInput). */
export type PinInputSsrProps = Partial<Pick<LabPinInput, 'type' | 'size' | 'label' | 'labelHidden' | 'helper' | 'error' | 'count' | 'valueType' | 'mask' | 'otp' | 'placeholder' | 'value' | 'defaultValue' | 'readonly' | 'disabled' | 'required' | 'invalid' | 'name'>>;
/** SSR-слоты <lab-pin-input> — предрендеренные строки контента. */
export type PinInputSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-pin-input> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderPinInput(
  props: PinInputSsrProps = {},
): string {
  return renderToString(html`<lab-pin-input
      type=${ifDefined(props.type)}
      size=${ifDefined(props.size)}
      label=${ifDefined(props.label)}
      ?label-hidden=${Boolean(props.labelHidden)}
      helper=${ifDefined(props.helper)}
      error=${ifDefined(props.error)}
      count=${ifDefined(props.count)}
      value-type=${ifDefined(props.valueType)}
      ?mask=${Boolean(props.mask)}
      ?otp=${Boolean(props.otp)}
      placeholder=${ifDefined(props.placeholder)}
      .value=${props.value}
      .defaultValue=${props.defaultValue}
      ?readonly=${Boolean(props.readonly)}
      ?disabled=${Boolean(props.disabled)}
      ?required=${Boolean(props.required)}
      ?invalid=${Boolean(props.invalid)}
      name=${ifDefined(props.name)}
    ></lab-pin-input>`);
}
