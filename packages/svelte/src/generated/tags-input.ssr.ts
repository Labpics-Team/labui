/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/tags-input';
import type { LabTagsInput } from '@labpics/ui-core/tags-input';

/** SSR-пропы <lab-tags-input> (атрибуты/свойства), взяты из класса ядра (LabTagsInput). */
export type TagsInputSsrProps = Partial<Pick<LabTagsInput, 'type' | 'size' | 'label' | 'labelHidden' | 'helper' | 'error' | 'placeholder' | 'max' | 'delimiter' | 'editable' | 'addOnPaste' | 'allowDuplicates' | 'value' | 'defaultValue' | 'readonly' | 'disabled' | 'required' | 'invalid' | 'name'>>;
/** SSR-слоты <lab-tags-input> — предрендеренные строки контента. */
export type TagsInputSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-tags-input> со стилями и Declarative Shadow DOM. Включите строку в
 * серверный ответ через v-html / {@html} / set:html либо серверный HTML-шаблон.
 * Обычная клиентская вставка innerHTML не создаёт declarative shadow root.
 */
export function renderTagsInput(
  props: TagsInputSsrProps = {},
): string {
  return renderToString(html`<lab-tags-input
      type=${ifDefined(props.type)}
      size=${ifDefined(props.size)}
      label=${ifDefined(props.label)}
      .labelHidden=${props.labelHidden === undefined ? noChange : Boolean(props.labelHidden)}
      helper=${ifDefined(props.helper)}
      error=${ifDefined(props.error)}
      placeholder=${ifDefined(props.placeholder)}
      max=${ifDefined(props.max)}
      delimiter=${ifDefined(props.delimiter)}
      .editable=${props.editable === undefined ? noChange : Boolean(props.editable)}
      .addOnPaste=${props.addOnPaste === undefined ? noChange : Boolean(props.addOnPaste)}
      .allowDuplicates=${props.allowDuplicates === undefined ? noChange : Boolean(props.allowDuplicates)}
      .value=${props.value}
      .defaultValue=${props.defaultValue}
      .readonly=${props.readonly === undefined ? noChange : Boolean(props.readonly)}
      .disabled=${props.disabled === undefined ? noChange : Boolean(props.disabled)}
      .required=${props.required === undefined ? noChange : Boolean(props.required)}
      .invalid=${props.invalid === undefined ? noChange : Boolean(props.invalid)}
      name=${ifDefined(props.name)}
    ></lab-tags-input>`);
}
