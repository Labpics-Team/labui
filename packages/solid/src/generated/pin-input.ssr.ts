/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/pin-input';
import type { LabPinInput } from '@labpics/ui-core/pin-input';

/** SSR-пропы <lab-pin-input> (атрибуты/свойства), взяты из класса ядра (LabPinInput). */
export type PinInputSsrProps = Partial<Pick<LabPinInput, 'type' | 'size' | 'label' | 'labelHidden' | 'helper' | 'error' | 'count' | 'valueType' | 'mask' | 'otp' | 'placeholder' | 'value' | 'defaultValue' | 'readonly' | 'disabled' | 'required' | 'invalid' | 'name'>>;
/** SSR-слоты <lab-pin-input> — предрендеренные строки контента. */
export type PinInputSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-pin-input> со стилями и Declarative Shadow DOM. Включите строку в
 * серверный ответ через v-html / {@html} / set:html либо серверный HTML-шаблон.
 * Обычная клиентская вставка innerHTML не создаёт declarative shadow root.
 */
export function renderPinInput(
  props: PinInputSsrProps = {},
): string {
  return renderToString(html`<lab-pin-input
      type=${ifDefined(props.type)}
      size=${ifDefined(props.size)}
      label=${ifDefined(props.label)}
      .labelHidden=${props.labelHidden === undefined ? noChange : Boolean(props.labelHidden)}
      helper=${ifDefined(props.helper)}
      error=${ifDefined(props.error)}
      count=${ifDefined(props.count)}
      value-type=${ifDefined(props.valueType)}
      .mask=${props.mask === undefined ? noChange : Boolean(props.mask)}
      .otp=${props.otp === undefined ? noChange : Boolean(props.otp)}
      placeholder=${ifDefined(props.placeholder)}
      .value=${props.value === undefined ? noChange : props.value}
      .defaultValue=${props.defaultValue === undefined ? noChange : props.defaultValue}
      .readonly=${props.readonly === undefined ? noChange : Boolean(props.readonly)}
      .disabled=${props.disabled === undefined ? noChange : Boolean(props.disabled)}
      .required=${props.required === undefined ? noChange : Boolean(props.required)}
      .invalid=${props.invalid === undefined ? noChange : Boolean(props.invalid)}
      name=${ifDefined(props.name)}
    ></lab-pin-input>`);
}
