import '@labpics/ui-core/checkbox';
import type { LabCheckbox } from '@labpics/ui-core/checkbox';
/** SSR-пропы <lab-checkbox> (атрибуты/свойства), взяты из класса ядра (LabCheckbox). */
export type CheckboxSsrProps = Partial<Pick<LabCheckbox, 'type' | 'size' | 'checked' | 'indeterminate' | 'defaultChecked' | 'defaultIndeterminate' | 'disabled' | 'name'>>;
/** SSR-слоты <lab-checkbox> — предрендеренные строки контента. */
export type CheckboxSsrSlots = {
    default?: string;
};
/**
 * Рендерит <lab-checkbox> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export declare function renderCheckbox(props?: CheckboxSsrProps, slots?: CheckboxSsrSlots): string;
//# sourceMappingURL=checkbox.ssr.d.ts.map