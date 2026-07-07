/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, unsafeHTML } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/checkbox';
import type { LabCheckbox } from '@labpics/ui-core/checkbox';

/** SSR-пропы <lab-checkbox> (атрибуты/свойства), взяты из класса ядра (LabCheckbox). */
export type CheckboxSsrProps = Partial<Pick<LabCheckbox, 'type' | 'size' | 'checked' | 'indeterminate' | 'defaultChecked' | 'defaultIndeterminate' | 'disabled' | 'name'>>;
/** SSR-слоты <lab-checkbox> — предрендеренные строки контента. */
export type CheckboxSsrSlots = { default?: string };

/**
 * Рендерит <lab-checkbox> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderCheckbox(
  props: CheckboxSsrProps = {},
  slots: CheckboxSsrSlots = {},
): string {
  return renderToString(html`<lab-checkbox
      type=${ifDefined(props.type)}
      size=${ifDefined(props.size)}
      ?checked=${Boolean(props.checked)}
      ?indeterminate=${Boolean(props.indeterminate)}
      ?default-checked=${Boolean(props.defaultChecked)}
      ?default-indeterminate=${Boolean(props.defaultIndeterminate)}
      ?disabled=${Boolean(props.disabled)}
      name=${ifDefined(props.name)}
    >${unsafeHTML(slots.default ?? '')}</lab-checkbox>`);
}
