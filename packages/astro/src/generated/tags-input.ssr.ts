/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/tags-input';
import type { LabTagsInput } from '@labpics/ui-core/tags-input';

/** SSR-пропы <lab-tags-input> (атрибуты/свойства), взяты из класса ядра (LabTagsInput). */
export type TagsInputSsrProps = Partial<Pick<LabTagsInput, 'type' | 'size' | 'label' | 'labelHidden' | 'helper' | 'error' | 'placeholder' | 'max' | 'delimiter' | 'editable' | 'addOnPaste' | 'allowDuplicates' | 'value' | 'defaultValue' | 'readonly' | 'disabled' | 'required' | 'invalid' | 'name'>>;
/** SSR-слоты <lab-tags-input> — предрендеренные строки контента. */
export type TagsInputSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-tags-input> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderTagsInput(
  props: TagsInputSsrProps = {},
): string {
  return renderToString(html`<lab-tags-input
      type=${ifDefined(props.type)}
      size=${ifDefined(props.size)}
      label=${ifDefined(props.label)}
      ?label-hidden=${Boolean(props.labelHidden)}
      helper=${ifDefined(props.helper)}
      error=${ifDefined(props.error)}
      placeholder=${ifDefined(props.placeholder)}
      max=${ifDefined(props.max)}
      delimiter=${ifDefined(props.delimiter)}
      ?editable=${Boolean(props.editable)}
      ?add-on-paste=${Boolean(props.addOnPaste)}
      ?allow-duplicates=${Boolean(props.allowDuplicates)}
      .value=${props.value}
      .defaultValue=${props.defaultValue}
      ?readonly=${Boolean(props.readonly)}
      ?disabled=${Boolean(props.disabled)}
      ?required=${Boolean(props.required)}
      ?invalid=${Boolean(props.invalid)}
      name=${ifDefined(props.name)}
    ></lab-tags-input>`);
}
