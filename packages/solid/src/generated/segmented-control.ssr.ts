/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange, unsafeHTML, slotProjectionShadowHtml } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/segmented-control';
import type { LabSegmentedControl } from '@labpics/ui-core/segmented-control';

/** SSR-пропы <lab-segmented-control> (атрибуты/свойства), взяты из класса ядра (LabSegmentedControl). */
export type SegmentedControlSsrProps = Partial<Pick<LabSegmentedControl, 'shape' | 'value' | 'defaultValue' | 'name' | 'label' | 'dir' | 'disabled' | 'required' | 'items'>> & { 'aria-label'?: string; 'form'?: string };
/** SSR-слоты <lab-segmented-control> — предрендеренные строки контента. */
export type SegmentedControlSsrSlots = { default?: string; dynamic?: Readonly<Record<string, string>> };

/**
 * Рендерит <lab-segmented-control> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderSegmentedControl(
  props: SegmentedControlSsrProps = {},
  slots: SegmentedControlSsrSlots = {},
): string {
  return renderToString(html`<lab-segmented-control
      shape=${ifDefined(props.shape)}
      .value=${props.value === undefined ? noChange : props.value}
      default-value=${ifDefined(props.defaultValue)}
      name=${ifDefined(props.name)}
      label=${ifDefined(props.label)}
      dir=${ifDefined(props.dir)}
      .disabled=${props.disabled === undefined ? noChange : props.disabled}
      .required=${props.required === undefined ? noChange : props.required}
      .items=${props.items === undefined ? noChange : props.items}
      aria-label=${ifDefined(props['aria-label'])}
      form=${ifDefined(props['form'])}
    >${Object.entries(slots.dynamic ?? {}).map(([name, content]) => html`<lab-slot slot=${name}>${unsafeHTML(slotProjectionShadowHtml)}${unsafeHTML(content)}</lab-slot>`)}${unsafeHTML(slots.default ?? '')}</lab-segmented-control>`);
}
