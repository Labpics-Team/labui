import '@labpics/ui-core/tooltip';
import type { LabTooltip } from '@labpics/ui-core/tooltip';
/** SSR-пропы <lab-tooltip> (атрибуты/свойства), взяты из класса ядра (LabTooltip). */
export type TooltipSsrProps = Partial<Pick<LabTooltip, 'placement' | 'size' | 'content' | 'openDelay' | 'closeDelay' | 'disabled' | 'arrow'>>;
/** SSR-слоты <lab-tooltip> — предрендеренные строки контента. */
export type TooltipSsrSlots = {
    default?: string;
    content?: string;
};
/**
 * Рендерит <lab-tooltip> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export declare function renderTooltip(props?: TooltipSsrProps, slots?: TooltipSsrSlots): string;
//# sourceMappingURL=tooltip.ssr.d.ts.map