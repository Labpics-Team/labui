import '@labpics/ui-core/radio-group';
import type { LabRadioGroup } from '@labpics/ui-core/radio-group';
/** SSR-пропы <lab-radio-group> (атрибуты/свойства), взяты из класса ядра (LabRadioGroup). */
export type RadioGroupSsrProps = Partial<Pick<LabRadioGroup, 'type' | 'size' | 'orientation' | 'value' | 'defaultValue' | 'disabled' | 'name' | 'label' | 'items'>>;
/** SSR-слоты <lab-radio-group> — предрендеренные строки контента. */
export type RadioGroupSsrSlots = Record<never, never>;
/**
 * Рендерит <lab-radio-group> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export declare function renderRadioGroup(props?: RadioGroupSsrProps): string;
//# sourceMappingURL=radio-group.ssr.d.ts.map