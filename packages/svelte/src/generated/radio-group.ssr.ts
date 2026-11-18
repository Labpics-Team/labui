/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange, unsafeHTML } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/radio-group';
import type { LabRadioGroup } from '@labpics/ui-core/radio-group';

/** SSR-пропы <lab-radio-group> (атрибуты/свойства), взяты из класса ядра (LabRadioGroup). */
export type RadioGroupSsrProps = Partial<Pick<LabRadioGroup, 'type' | 'size' | 'variant' | 'orientation' | 'value' | 'defaultValue' | 'controlled' | 'disabled' | 'required' | 'name' | 'label' | 'items'>>;
/** SSR-слоты <lab-radio-group> — предрендеренные строки контента. */
export type RadioGroupSsrSlots = { default?: string; dynamic?: Readonly<Record<string, string>> };

/**
 * Рендерит <lab-radio-group> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderRadioGroup(
  props: RadioGroupSsrProps = {},
  slots: RadioGroupSsrSlots = {},
): string {
  return renderToString(html`<lab-radio-group
      type=${ifDefined(props.type)}
      size=${ifDefined(props.size)}
      variant=${ifDefined(props.variant)}
      orientation=${ifDefined(props.orientation)}
      value=${ifDefined(props.value)}
      default-value=${ifDefined(props.defaultValue)}
      ?controlled=${Boolean(props.controlled)}
      ?disabled=${Boolean(props.disabled)}
      ?required=${Boolean(props.required)}
      name=${ifDefined(props.name)}
      label=${ifDefined(props.label)}
      .items=${props.items === undefined ? noChange : props.items}
    >${Object.entries(slots.dynamic ?? {}).map(([name, content]) => html`<span slot=${name}>${unsafeHTML(content)}</span>`)}${unsafeHTML(slots.default ?? '')}</lab-radio-group>`);
}
