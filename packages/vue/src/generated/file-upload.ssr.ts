/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/file-upload';
import type { LabFileUpload } from '@labpics/ui-core/file-upload';

/** SSR-пропы <lab-file-upload> (атрибуты/свойства), взяты из класса ядра (LabFileUpload). */
export type FileUploadSsrProps = Partial<Pick<LabFileUpload, 'view' | 'size' | 'label' | 'labelHidden' | 'helper' | 'error' | 'name' | 'accept' | 'multiple' | 'maxFiles' | 'maxFileSize' | 'minFileSize' | 'disabled' | 'readonly' | 'required' | 'invalid' | 'acceptedFiles' | 'defaultAcceptedFiles' | 'translations'>> & { 'aria-label'?: string; 'form'?: string };
/** SSR-слоты <lab-file-upload> — предрендеренные строки контента. */
export type FileUploadSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-file-upload> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderFileUpload(
  props: FileUploadSsrProps = {},
): string {
  return renderToString(html`<lab-file-upload
      view=${ifDefined(props.view)}
      size=${ifDefined(props.size)}
      label=${ifDefined(props.label)}
      .labelHidden=${props.labelHidden === undefined ? noChange : props.labelHidden}
      helper=${ifDefined(props.helper)}
      error=${ifDefined(props.error)}
      name=${ifDefined(props.name)}
      accept=${ifDefined(props.accept)}
      .multiple=${props.multiple === undefined ? noChange : props.multiple}
      max-files=${ifDefined(props.maxFiles)}
      max-file-size=${ifDefined(props.maxFileSize)}
      min-file-size=${ifDefined(props.minFileSize)}
      .disabled=${props.disabled === undefined ? noChange : props.disabled}
      .readonly=${props.readonly === undefined ? noChange : props.readonly}
      .required=${props.required === undefined ? noChange : props.required}
      .invalid=${props.invalid === undefined ? noChange : props.invalid}
      .acceptedFiles=${props.acceptedFiles === undefined ? noChange : props.acceptedFiles}
      .defaultAcceptedFiles=${props.defaultAcceptedFiles === undefined ? noChange : props.defaultAcceptedFiles}
      .translations=${props.translations === undefined ? noChange : props.translations}
      aria-label=${ifDefined(props['aria-label'])}
      form=${ifDefined(props['form'])}
    ></lab-file-upload>`);
}
