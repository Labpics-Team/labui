import '@labpics/ui-core/dialog';
import type { LabDialog } from '@labpics/ui-core/dialog';
/** SSR-пропы <lab-dialog> (атрибуты/свойства), взяты из класса ядра (LabDialog). */
export type DialogSsrProps = Partial<Pick<LabDialog, 'size' | 'modal' | 'closable' | 'heading' | 'description'>>;
/** SSR-слоты <lab-dialog> — предрендеренные строки контента. */
export type DialogSsrSlots = {
    default?: string;
    content?: string;
};
/**
 * Рендерит <lab-dialog> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export declare function renderDialog(props?: DialogSsrProps, slots?: DialogSsrSlots): string;
//# sourceMappingURL=dialog.ssr.d.ts.map