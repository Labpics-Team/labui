import '@labpics/ui-core/badge';
import type { LabBadge } from '@labpics/ui-core/badge';
/** SSR-пропы <lab-badge> (атрибуты/свойства), взяты из класса ядра (LabBadge). */
export type BadgeSsrProps = Partial<Pick<LabBadge, 'color' | 'type' | 'disabled'>>;
/** SSR-слоты <lab-badge> — предрендеренные строки контента. */
export type BadgeSsrSlots = {
    default?: string;
    dot?: string;
};
/**
 * Рендерит <lab-badge> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export declare function renderBadge(props?: BadgeSsrProps, slots?: BadgeSsrSlots): string;
//# sourceMappingURL=badge.ssr.d.ts.map