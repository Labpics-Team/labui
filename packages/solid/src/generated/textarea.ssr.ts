/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/textarea';
import type { LabTextarea } from '@labpics/ui-core/textarea';

/** SSR-пропы <lab-textarea> (атрибуты/свойства), взяты из класса ядра (LabTextarea). */
export type TextareaSsrProps = Partial<Pick<LabTextarea, 'type' | 'size' | 'label' | 'labelHidden' | 'helper' | 'error' | 'value' | 'placeholder' | 'rows' | 'autoResize' | 'readonly' | 'disabled' | 'required' | 'invalid' | 'name'>>;
/** SSR-слоты <lab-textarea> — предрендеренные строки контента. */
export type TextareaSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-textarea> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderTextarea(
  props: TextareaSsrProps = {},
): string {
  return renderToString(html`<lab-textarea
      type=${ifDefined(props.type)}
      size=${ifDefined(props.size)}
      label=${ifDefined(props.label)}
      ?label-hidden=${Boolean(props.labelHidden)}
      helper=${ifDefined(props.helper)}
      error=${ifDefined(props.error)}
      value=${ifDefined(props.value)}
      placeholder=${ifDefined(props.placeholder)}
      rows=${ifDefined(props.rows)}
      ?auto-resize=${Boolean(props.autoResize)}
      ?readonly=${Boolean(props.readonly)}
      ?disabled=${Boolean(props.disabled)}
      ?required=${Boolean(props.required)}
      ?invalid=${Boolean(props.invalid)}
      name=${ifDefined(props.name)}
    ></lab-textarea>`);
}
