/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange, unsafeHTML } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/input';
import type { LabInput } from '@labpics/ui-core/input';

/** SSR-пропы <lab-input> (атрибуты/свойства), взяты из класса ядра (LabInput). */
export type InputSsrProps = Partial<Pick<LabInput, 'type' | 'size' | 'label' | 'labelHidden' | 'helper' | 'error' | 'value' | 'placeholder' | 'inputType' | 'autocomplete' | 'readonly' | 'disabled' | 'required' | 'invalid' | 'name' | 'maxLength' | 'minLength' | 'pattern'>> & { 'aria-label'?: string; 'form'?: string };
/** SSR-слоты <lab-input> — предрендеренные строки контента. */
export type InputSsrSlots = { leading?: string; trailing?: string };

/**
 * Рендерит <lab-input> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderInput(
  props: InputSsrProps = {},
  slots: InputSsrSlots = {},
): string {
  return renderToString(html`<lab-input
      type=${ifDefined(props.type)}
      size=${ifDefined(props.size)}
      label=${ifDefined(props.label)}
      .labelHidden=${props.labelHidden === undefined ? noChange : props.labelHidden}
      helper=${ifDefined(props.helper)}
      error=${ifDefined(props.error)}
      value=${ifDefined(props.value)}
      placeholder=${ifDefined(props.placeholder)}
      input-type=${ifDefined(props.inputType)}
      autocomplete=${ifDefined(props.autocomplete)}
      .readonly=${props.readonly === undefined ? noChange : props.readonly}
      .disabled=${props.disabled === undefined ? noChange : props.disabled}
      .required=${props.required === undefined ? noChange : props.required}
      .invalid=${props.invalid === undefined ? noChange : props.invalid}
      name=${ifDefined(props.name)}
      maxlength=${ifDefined(props.maxLength)}
      minlength=${ifDefined(props.minLength)}
      pattern=${ifDefined(props.pattern)}
      aria-label=${ifDefined(props['aria-label'])}
      form=${ifDefined(props['form'])}
    >${slots.leading ? html`<span slot="leading">${unsafeHTML(slots.leading)}</span>` : ''}${slots.trailing ? html`<span slot="trailing">${unsafeHTML(slots.trailing)}</span>` : ''}</lab-input>`);
}
