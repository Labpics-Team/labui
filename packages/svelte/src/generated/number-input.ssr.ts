/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/number-input';
import type { LabNumberInput } from '@labpics/ui-core/number-input';

/** SSR-пропы <lab-number-input> (атрибуты/свойства), взяты из класса ядра (LabNumberInput). */
export type NumberInputSsrProps = Partial<Pick<LabNumberInput, 'type' | 'size' | 'label' | 'labelHidden' | 'helper' | 'error' | 'value' | 'defaultValue' | 'placeholder' | 'min' | 'max' | 'step' | 'scrubber' | 'allowMouseWheel' | 'readonly' | 'disabled' | 'required' | 'invalid' | 'name'>>;
/** SSR-слоты <lab-number-input> — предрендеренные строки контента. */
export type NumberInputSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-number-input> со стилями и Declarative Shadow DOM. Включите строку в
 * серверный ответ через v-html / {@html} / set:html либо серверный HTML-шаблон.
 * Обычная клиентская вставка innerHTML не создаёт declarative shadow root.
 */
export function renderNumberInput(
  props: NumberInputSsrProps = {},
): string {
  return renderToString(html`<lab-number-input
      type=${ifDefined(props.type)}
      size=${ifDefined(props.size)}
      label=${ifDefined(props.label)}
      .labelHidden=${props.labelHidden === undefined ? noChange : Boolean(props.labelHidden)}
      helper=${ifDefined(props.helper)}
      error=${ifDefined(props.error)}
      value=${ifDefined(props.value)}
      default-value=${ifDefined(props.defaultValue)}
      placeholder=${ifDefined(props.placeholder)}
      min=${ifDefined(props.min)}
      max=${ifDefined(props.max)}
      step=${ifDefined(props.step)}
      .scrubber=${props.scrubber === undefined ? noChange : Boolean(props.scrubber)}
      .allowMouseWheel=${props.allowMouseWheel === undefined ? noChange : Boolean(props.allowMouseWheel)}
      .readonly=${props.readonly === undefined ? noChange : Boolean(props.readonly)}
      .disabled=${props.disabled === undefined ? noChange : Boolean(props.disabled)}
      .required=${props.required === undefined ? noChange : Boolean(props.required)}
      .invalid=${props.invalid === undefined ? noChange : Boolean(props.invalid)}
      name=${ifDefined(props.name)}
    ></lab-number-input>`);
}
