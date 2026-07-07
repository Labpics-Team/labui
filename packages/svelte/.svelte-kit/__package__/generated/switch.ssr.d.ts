import '@labpics/ui-core/switch';
import type { LabSwitch } from '@labpics/ui-core/switch';
/** SSR-пропы <lab-switch> (атрибуты/свойства), взяты из класса ядра (LabSwitch). */
export type SwitchSsrProps = Partial<Pick<LabSwitch, 'type' | 'size' | 'checked' | 'defaultChecked' | 'disabled' | 'name'>>;
/** SSR-слоты <lab-switch> — предрендеренные строки контента. */
export type SwitchSsrSlots = {
    default?: string;
    iconOff?: string;
    iconOn?: string;
};
/**
 * Рендерит <lab-switch> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export declare function renderSwitch(props?: SwitchSsrProps, slots?: SwitchSsrSlots): string;
//# sourceMappingURL=switch.ssr.d.ts.map