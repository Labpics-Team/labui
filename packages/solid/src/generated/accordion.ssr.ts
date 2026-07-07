/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/accordion';
import type { LabAccordion } from '@labpics/ui-core/accordion';

/** SSR-пропы <lab-accordion> (атрибуты/свойства), взяты из класса ядра (LabAccordion). */
export type AccordionSsrProps = Partial<Pick<LabAccordion, 'orientation' | 'size' | 'multiple' | 'collapsible' | 'disabled' | 'value' | 'defaultValue' | 'items'>>;
/** SSR-слоты <lab-accordion> — предрендеренные строки контента. */
export type AccordionSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-accordion> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderAccordion(
  props: AccordionSsrProps = {},
): string {
  return renderToString(html`<lab-accordion
      orientation=${ifDefined(props.orientation)}
      size=${ifDefined(props.size)}
      ?multiple=${Boolean(props.multiple)}
      ?collapsible=${Boolean(props.collapsible)}
      ?disabled=${Boolean(props.disabled)}
      .value=${props.value}
      .defaultValue=${props.defaultValue}
      .items=${props.items}
    ></lab-accordion>`);
}
