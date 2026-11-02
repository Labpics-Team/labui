/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/input';
import type { LabInput } from '@labpics/ui-core/input';

/** SSR-пропы <lab-input> (атрибуты/свойства), взяты из класса ядра (LabInput). */
export type InputSsrProps = Partial<Pick<LabInput, 'type' | 'size' | 'label' | 'labelHidden' | 'helper' | 'error' | 'value' | 'placeholder' | 'inputType' | 'autocomplete' | 'readonly' | 'disabled' | 'required' | 'invalid' | 'name'>>;
/** SSR-слоты <lab-input> — предрендеренные строки контента. */
export type InputSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-input> со стилями и Declarative Shadow DOM. Включите строку в
 * серверный ответ через v-html / {@html} / set:html либо серверный HTML-шаблон.
 * Обычная клиентская вставка innerHTML не создаёт declarative shadow root.
 */
export function renderInput(
  props: InputSsrProps = {},
): string {
  return renderToString(html`<lab-input
      type=${ifDefined(props.type)}
      size=${ifDefined(props.size)}
      label=${ifDefined(props.label)}
      .labelHidden=${props.labelHidden === undefined ? noChange : Boolean(props.labelHidden)}
      helper=${ifDefined(props.helper)}
      error=${ifDefined(props.error)}
      value=${ifDefined(props.value)}
      placeholder=${ifDefined(props.placeholder)}
      input-type=${ifDefined(props.inputType)}
      autocomplete=${ifDefined(props.autocomplete)}
      .readonly=${props.readonly === undefined ? noChange : Boolean(props.readonly)}
      .disabled=${props.disabled === undefined ? noChange : Boolean(props.disabled)}
      .required=${props.required === undefined ? noChange : Boolean(props.required)}
      .invalid=${props.invalid === undefined ? noChange : Boolean(props.invalid)}
      name=${ifDefined(props.name)}
    ></lab-input>`);
}
