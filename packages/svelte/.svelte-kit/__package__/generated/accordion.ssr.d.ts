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
export declare function renderAccordion(props?: AccordionSsrProps): string;
//# sourceMappingURL=accordion.ssr.d.ts.map