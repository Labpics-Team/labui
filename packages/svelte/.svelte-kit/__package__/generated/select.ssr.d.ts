import '@labpics/ui-core/select';
import type { LabSelect } from '@labpics/ui-core/select';
/** SSR-пропы <lab-select> (атрибуты/свойства), взяты из класса ядра (LabSelect). */
export type SelectSsrProps = Partial<Pick<LabSelect, 'size' | 'placement' | 'multiple' | 'disabled' | 'name' | 'placeholder' | 'label' | 'value' | 'defaultValue' | 'items'>>;
/** SSR-слоты <lab-select> — предрендеренные строки контента. */
export type SelectSsrSlots = Record<never, never>;
/**
 * Рендерит <lab-select> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export declare function renderSelect(props?: SelectSsrProps): string;
//# sourceMappingURL=select.ssr.d.ts.map