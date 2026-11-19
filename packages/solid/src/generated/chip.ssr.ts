/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange, unsafeHTML } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/chip';
import type { LabChip } from '@labpics/ui-core/chip';

/** SSR-пропы <lab-chip> (атрибуты/свойства), взяты из класса ядра (LabChip). */
export type ChipSsrProps = Partial<Pick<LabChip, 'mode' | 'size' | 'sharp' | 'active' | 'selected' | 'defaultSelected' | 'controlled' | 'disabled' | 'loading' | 'showLeading' | 'name' | 'value'>> & { 'aria-label'?: string; 'form'?: string };
/** SSR-слоты <lab-chip> — предрендеренные строки контента. */
export type ChipSsrSlots = { default?: string; leading?: string };

/**
 * Рендерит <lab-chip> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderChip(
  props: ChipSsrProps = {},
  slots: ChipSsrSlots = {},
): string {
  return renderToString(html`<lab-chip
      mode=${ifDefined(props.mode)}
      size=${ifDefined(props.size)}
      .sharp=${props.sharp === undefined ? noChange : props.sharp}
      .active=${props.active === undefined ? noChange : props.active}
      .selected=${props.selected === undefined ? noChange : props.selected}
      .defaultSelected=${props.defaultSelected === undefined ? noChange : props.defaultSelected}
      .controlled=${props.controlled === undefined ? noChange : props.controlled}
      .disabled=${props.disabled === undefined ? noChange : props.disabled}
      .loading=${props.loading === undefined ? noChange : props.loading}
      .showLeading=${props.showLeading === undefined ? noChange : props.showLeading}
      name=${ifDefined(props.name)}
      value=${ifDefined(props.value)}
      aria-label=${ifDefined(props['aria-label'])}
      form=${ifDefined(props['form'])}
    >${slots.leading ? html`<span slot="leading">${unsafeHTML(slots.leading)}</span>` : ''}${unsafeHTML(slots.default ?? '')}</lab-chip>`);
}
