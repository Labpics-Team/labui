import '@labpics/ui-core/combobox';
import type { LabCombobox } from '@labpics/ui-core/combobox';
/** SSR-пропы <lab-combobox> (атрибуты/свойства), взяты из класса ядра (LabCombobox). */
export type ComboboxSsrProps = Partial<Pick<LabCombobox, 'type' | 'size' | 'placement' | 'multiple' | 'disabled' | 'readonly' | 'required' | 'invalid' | 'name' | 'placeholder' | 'label' | 'labelHidden' | 'helper' | 'error' | 'value' | 'defaultValue' | 'items'>>;
/** SSR-слоты <lab-combobox> — предрендеренные строки контента. */
export type ComboboxSsrSlots = Record<never, never>;
/**
 * Рендерит <lab-combobox> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export declare function renderCombobox(props?: ComboboxSsrProps): string;
//# sourceMappingURL=combobox.ssr.d.ts.map