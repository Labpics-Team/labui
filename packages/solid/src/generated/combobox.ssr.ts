/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/combobox';
import type { LabCombobox } from '@labpics/ui-core/combobox';

/** SSR-пропы <lab-combobox> (атрибуты/свойства), взяты из класса ядра (LabCombobox). */
export type ComboboxSsrProps = Partial<Pick<LabCombobox, 'type' | 'size' | 'placement' | 'multiple' | 'disabled' | 'readonly' | 'required' | 'invalid' | 'name' | 'placeholder' | 'label' | 'labelHidden' | 'helper' | 'error' | 'value' | 'defaultValue' | 'items'>>;
/** SSR-слоты <lab-combobox> — предрендеренные строки контента. */
export type ComboboxSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-combobox> со стилями и Declarative Shadow DOM. Включите строку в
 * серверный ответ через v-html / {@html} / set:html либо серверный HTML-шаблон.
 * Обычная клиентская вставка innerHTML не создаёт declarative shadow root.
 */
export function renderCombobox(
  props: ComboboxSsrProps = {},
): string {
  return renderToString(html`<lab-combobox
      type=${ifDefined(props.type)}
      size=${ifDefined(props.size)}
      placement=${ifDefined(props.placement)}
      .multiple=${props.multiple === undefined ? noChange : Boolean(props.multiple)}
      .disabled=${props.disabled === undefined ? noChange : Boolean(props.disabled)}
      .readonly=${props.readonly === undefined ? noChange : Boolean(props.readonly)}
      .required=${props.required === undefined ? noChange : Boolean(props.required)}
      .invalid=${props.invalid === undefined ? noChange : Boolean(props.invalid)}
      name=${ifDefined(props.name)}
      placeholder=${ifDefined(props.placeholder)}
      label=${ifDefined(props.label)}
      .labelHidden=${props.labelHidden === undefined ? noChange : Boolean(props.labelHidden)}
      helper=${ifDefined(props.helper)}
      error=${ifDefined(props.error)}
      .value=${props.value}
      .defaultValue=${props.defaultValue}
      .items=${props.items}
    ></lab-combobox>`);
}
