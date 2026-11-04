/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/select';
import type { LabSelect } from '@labpics/ui-core/select';

/** SSR-пропы <lab-select> (атрибуты/свойства), взяты из класса ядра (LabSelect). */
export type SelectSsrProps = Partial<Pick<LabSelect, 'size' | 'placement' | 'multiple' | 'disabled' | 'name' | 'placeholder' | 'label' | 'value' | 'defaultValue' | 'items'>>;
/** SSR-слоты <lab-select> — предрендеренные строки контента. */
export type SelectSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-select> со стилями и Declarative Shadow DOM. Включите строку в
 * серверный ответ через v-html / {@html} / set:html либо серверный HTML-шаблон.
 * Обычная клиентская вставка innerHTML не создаёт declarative shadow root.
 */
export function renderSelect(
  props: SelectSsrProps = {},
): string {
  return renderToString(html`<lab-select
      size=${ifDefined(props.size)}
      placement=${ifDefined(props.placement)}
      .multiple=${props.multiple === undefined ? noChange : Boolean(props.multiple)}
      .disabled=${props.disabled === undefined ? noChange : Boolean(props.disabled)}
      name=${ifDefined(props.name)}
      placeholder=${ifDefined(props.placeholder)}
      label=${ifDefined(props.label)}
      .value=${props.value}
      .defaultValue=${props.defaultValue}
      .items=${props.items}
    ></lab-select>`);
}
