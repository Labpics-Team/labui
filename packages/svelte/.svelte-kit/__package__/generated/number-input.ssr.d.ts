import '@labpics/ui-core/number-input';
import type { LabNumberInput } from '@labpics/ui-core/number-input';
/** SSR-пропы <lab-number-input> (атрибуты/свойства), взяты из класса ядра (LabNumberInput). */
export type NumberInputSsrProps = Partial<Pick<LabNumberInput, 'type' | 'size' | 'label' | 'labelHidden' | 'helper' | 'error' | 'value' | 'defaultValue' | 'placeholder' | 'min' | 'max' | 'step' | 'scrubber' | 'allowMouseWheel' | 'readonly' | 'disabled' | 'required' | 'invalid' | 'name'>>;
/** SSR-слоты <lab-number-input> — предрендеренные строки контента. */
export type NumberInputSsrSlots = Record<never, never>;
/**
 * Рендерит <lab-number-input> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export declare function renderNumberInput(props?: NumberInputSsrProps): string;
//# sourceMappingURL=number-input.ssr.d.ts.map