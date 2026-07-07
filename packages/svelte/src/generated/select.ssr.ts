/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/select';
import type { LabSelect } from '@labpics/ui-core/select';

/** SSR-пропы <lab-select> (атрибуты/свойства), взяты из класса ядра (LabSelect). */
export type SelectSsrProps = Partial<Pick<LabSelect, 'size' | 'placement' | 'multiple' | 'disabled' | 'name' | 'placeholder' | 'label' | 'value' | 'defaultValue' | 'items'>>;
/** SSR-слоты <lab-select> — предрендеренные строки контента. */
export type SelectSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-select> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderSelect(
  props: SelectSsrProps = {},
): string {
  return renderToString(html`<lab-select
      size=${ifDefined(props.size)}
      placement=${ifDefined(props.placement)}
      ?multiple=${Boolean(props.multiple)}
      ?disabled=${Boolean(props.disabled)}
      name=${ifDefined(props.name)}
      placeholder=${ifDefined(props.placeholder)}
      label=${ifDefined(props.label)}
      .value=${props.value}
      .defaultValue=${props.defaultValue}
      .items=${props.items}
    ></lab-select>`);
}
