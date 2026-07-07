import '@labpics/ui-core/kbd';
import type { LabKbd } from '@labpics/ui-core/kbd';
/** SSR-пропы <lab-kbd> (атрибуты/свойства), взяты из класса ядра (LabKbd). */
export type KbdSsrProps = Partial<Pick<LabKbd, 'size'>>;
/** SSR-слоты <lab-kbd> — предрендеренные строки контента. */
export type KbdSsrSlots = {
    default?: string;
};
/**
 * Рендерит <lab-kbd> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export declare function renderKbd(props?: KbdSsrProps, slots?: KbdSsrSlots): string;
//# sourceMappingURL=kbd.ssr.d.ts.map