import '@labpics/ui-core/pin-input';
import type { LabPinInput } from '@labpics/ui-core/pin-input';
/** SSR-пропы <lab-pin-input> (атрибуты/свойства), взяты из класса ядра (LabPinInput). */
export type PinInputSsrProps = Partial<Pick<LabPinInput, 'type' | 'size' | 'label' | 'labelHidden' | 'helper' | 'error' | 'count' | 'valueType' | 'mask' | 'otp' | 'placeholder' | 'value' | 'defaultValue' | 'readonly' | 'disabled' | 'required' | 'invalid' | 'name'>>;
/** SSR-слоты <lab-pin-input> — предрендеренные строки контента. */
export type PinInputSsrSlots = Record<never, never>;
/**
 * Рендерит <lab-pin-input> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export declare function renderPinInput(props?: PinInputSsrProps): string;
//# sourceMappingURL=pin-input.ssr.d.ts.map