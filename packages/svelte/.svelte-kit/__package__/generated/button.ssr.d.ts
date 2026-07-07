import '@labpics/ui-core/button';
import type { LabButton } from '@labpics/ui-core/button';
/** SSR-пропы <lab-button> (атрибуты/свойства), взяты из класса ядра (LabButton). */
export type ButtonSsrProps = Partial<Pick<LabButton, 'type' | 'kind' | 'size' | 'icon' | 'loading' | 'disabled' | 'htmlType'>>;
/** SSR-слоты <lab-button> — предрендеренные строки контента. */
export type ButtonSsrSlots = {
    default?: string;
    icon?: string;
};
/**
 * Рендерит <lab-button> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export declare function renderButton(props?: ButtonSsrProps, slots?: ButtonSsrSlots): string;
//# sourceMappingURL=button.ssr.d.ts.map