import '@labpics/ui-core/alert-dialog';
import type { LabAlertDialog } from '@labpics/ui-core/alert-dialog';
/** SSR-пропы <lab-alert-dialog> (атрибуты/свойства), взяты из класса ядра (LabAlertDialog). */
export type AlertDialogSsrProps = Partial<Pick<LabAlertDialog, 'size' | 'modal' | 'closable' | 'heading' | 'description'>>;
/** SSR-слоты <lab-alert-dialog> — предрендеренные строки контента. */
export type AlertDialogSsrSlots = {
    default?: string;
    content?: string;
};
/**
 * Рендерит <lab-alert-dialog> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export declare function renderAlertDialog(props?: AlertDialogSsrProps, slots?: AlertDialogSsrSlots): string;
//# sourceMappingURL=alert-dialog.ssr.d.ts.map