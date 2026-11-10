/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/accordion';
import type { LabAccordion } from '@labpics/ui-core/accordion';

/** SSR-пропы <lab-accordion> (атрибуты/свойства), взяты из класса ядра (LabAccordion). */
export type AccordionSsrProps = Partial<Pick<LabAccordion, 'orientation' | 'size' | 'multiple' | 'collapsible' | 'disabled' | 'value' | 'defaultValue' | 'items'>>;
/** SSR-слоты <lab-accordion> — предрендеренные строки контента. */
export type AccordionSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-accordion> со стилями и Declarative Shadow DOM. Включите строку в
 * серверный ответ через v-html / {@html} / set:html либо серверный HTML-шаблон.
 * Обычная клиентская вставка innerHTML не создаёт declarative shadow root.
 */
export function renderAccordion(
  props: AccordionSsrProps = {},
): string {
  return renderToString(html`<lab-accordion
      orientation=${ifDefined(props.orientation)}
      size=${ifDefined(props.size)}
      .multiple=${props.multiple === undefined ? noChange : Boolean(props.multiple)}
      .collapsible=${props.collapsible === undefined ? noChange : Boolean(props.collapsible)}
      .disabled=${props.disabled === undefined ? noChange : Boolean(props.disabled)}
      .value=${props.value === undefined ? noChange : props.value}
      .defaultValue=${props.defaultValue === undefined ? noChange : props.defaultValue}
      .items=${props.items === undefined ? noChange : props.items}
    ></lab-accordion>`);
}
