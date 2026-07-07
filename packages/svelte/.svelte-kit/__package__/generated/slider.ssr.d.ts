import '@labpics/ui-core/slider';
import type { LabSlider } from '@labpics/ui-core/slider';
/** SSR-пропы <lab-slider> (атрибуты/свойства), взяты из класса ядра (LabSlider). */
export type SliderSsrProps = Partial<Pick<LabSlider, 'size' | 'orientation' | 'label' | 'labelHidden' | 'helper' | 'error' | 'value' | 'defaultValue' | 'min' | 'max' | 'step' | 'marks' | 'showValue' | 'readonly' | 'disabled' | 'invalid' | 'name'>>;
/** SSR-слоты <lab-slider> — предрендеренные строки контента. */
export type SliderSsrSlots = Record<never, never>;
/**
 * Рендерит <lab-slider> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export declare function renderSlider(props?: SliderSsrProps): string;
//# sourceMappingURL=slider.ssr.d.ts.map