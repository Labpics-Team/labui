import '@labpics/ui-core/card';
import type { LabCard } from '@labpics/ui-core/card';
/** SSR-пропы <lab-card> (атрибуты/свойства), взяты из класса ядра (LabCard). */
export type CardSsrProps = Partial<Pick<LabCard, 'variant' | 'padding' | 'interactive'>>;
/** SSR-слоты <lab-card> — предрендеренные строки контента. */
export type CardSsrSlots = {
    default?: string;
    footer?: string;
    header?: string;
    media?: string;
};
/**
 * Рендерит <lab-card> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export declare function renderCard(props?: CardSsrProps, slots?: CardSsrSlots): string;
//# sourceMappingURL=card.ssr.d.ts.map