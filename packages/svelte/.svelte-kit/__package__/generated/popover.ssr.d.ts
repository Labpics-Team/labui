import '@labpics/ui-core/popover';
import type { LabPopover } from '@labpics/ui-core/popover';
/** SSR-пропы <lab-popover> (атрибуты/свойства), взяты из класса ядра (LabPopover). */
export type PopoverSsrProps = Partial<Pick<LabPopover, 'placement' | 'size' | 'modal' | 'closable' | 'arrow' | 'heading' | 'description'>>;
/** SSR-слоты <lab-popover> — предрендеренные строки контента. */
export type PopoverSsrSlots = {
    default?: string;
    content?: string;
};
/**
 * Рендерит <lab-popover> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export declare function renderPopover(props?: PopoverSsrProps, slots?: PopoverSsrSlots): string;
//# sourceMappingURL=popover.ssr.d.ts.map