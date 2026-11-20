/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange, unsafeHTML, slotProjectionShadowHtml } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/choicebox';
import type { LabChoicebox } from '@labpics/ui-core/choicebox';

/** SSR-пропы <lab-choicebox> (атрибуты/свойства), взяты из класса ядра (LabChoicebox). */
export type ChoiceboxSsrProps = Partial<Pick<LabChoicebox, 'layout' | 'multiple' | 'value' | 'defaultValue' | 'controlled' | 'disabled' | 'required' | 'name' | 'label' | 'items'>> & { 'aria-label'?: string; 'form'?: string };
/** SSR-слоты <lab-choicebox> — предрендеренные строки контента. */
export type ChoiceboxSsrSlots = { default?: string; dynamic?: Readonly<Record<string, string>> };

/**
 * Рендерит <lab-choicebox> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderChoicebox(
  props: ChoiceboxSsrProps = {},
  slots: ChoiceboxSsrSlots = {},
): string {
  return renderToString(html`<lab-choicebox
      layout=${ifDefined(props.layout)}
      .multiple=${props.multiple === undefined ? noChange : props.multiple}
      .value=${props.value === undefined ? noChange : props.value}
      .defaultValue=${props.defaultValue === undefined ? noChange : props.defaultValue}
      .controlled=${props.controlled === undefined ? noChange : props.controlled}
      .disabled=${props.disabled === undefined ? noChange : props.disabled}
      .required=${props.required === undefined ? noChange : props.required}
      name=${ifDefined(props.name)}
      label=${ifDefined(props.label)}
      .items=${props.items === undefined ? noChange : props.items}
      aria-label=${ifDefined(props['aria-label'])}
      form=${ifDefined(props['form'])}
    >${Object.entries(slots.dynamic ?? {}).map(([name, content]) => html`<lab-slot slot=${name}>${unsafeHTML(slotProjectionShadowHtml)}${unsafeHTML(content)}</lab-slot>`)}${unsafeHTML(slots.default ?? '')}</lab-choicebox>`);
}
