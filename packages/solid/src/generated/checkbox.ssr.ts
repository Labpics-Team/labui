/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange, unsafeHTML } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/checkbox';
import type { LabCheckbox } from '@labpics/ui-core/checkbox';

/** SSR-пропы <lab-checkbox> (атрибуты/свойства), взяты из класса ядра (LabCheckbox). */
export type CheckboxSsrProps = Partial<Pick<LabCheckbox, 'type' | 'size' | 'checked' | 'indeterminate' | 'defaultChecked' | 'defaultIndeterminate' | 'disabled' | 'name'>>;
/** SSR-слоты <lab-checkbox> — предрендеренные строки контента. */
export type CheckboxSsrSlots = { default?: string };

/**
 * Рендерит <lab-checkbox> со стилями и Declarative Shadow DOM. Включите строку в
 * серверный ответ через v-html / {@html} / set:html либо серверный HTML-шаблон.
 * Обычная клиентская вставка innerHTML не создаёт declarative shadow root.
 */
export function renderCheckbox(
  props: CheckboxSsrProps = {},
  slots: CheckboxSsrSlots = {},
): string {
  return renderToString(html`<lab-checkbox
      type=${ifDefined(props.type)}
      size=${ifDefined(props.size)}
      .checked=${props.checked === undefined ? noChange : Boolean(props.checked)}
      .indeterminate=${props.indeterminate === undefined ? noChange : Boolean(props.indeterminate)}
      .defaultChecked=${props.defaultChecked === undefined ? noChange : Boolean(props.defaultChecked)}
      .defaultIndeterminate=${props.defaultIndeterminate === undefined ? noChange : Boolean(props.defaultIndeterminate)}
      .disabled=${props.disabled === undefined ? noChange : Boolean(props.disabled)}
      name=${ifDefined(props.name)}
    >${unsafeHTML(slots.default ?? '')}</lab-checkbox>`);
}
