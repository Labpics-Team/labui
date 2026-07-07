import '@labpics/ui-core/input';
import type { LabInput } from '@labpics/ui-core/input';
/** SSR-пропы <lab-input> (атрибуты/свойства), взяты из класса ядра (LabInput). */
export type InputSsrProps = Partial<Pick<LabInput, 'type' | 'size' | 'label' | 'labelHidden' | 'helper' | 'error' | 'value' | 'placeholder' | 'inputType' | 'autocomplete' | 'readonly' | 'disabled' | 'required' | 'invalid' | 'name'>>;
/** SSR-слоты <lab-input> — предрендеренные строки контента. */
export type InputSsrSlots = Record<never, never>;
/**
 * Рендерит <lab-input> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export declare function renderInput(props?: InputSsrProps): string;
//# sourceMappingURL=input.ssr.d.ts.map