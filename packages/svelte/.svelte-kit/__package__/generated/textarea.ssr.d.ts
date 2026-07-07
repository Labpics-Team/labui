import '@labpics/ui-core/textarea';
import type { LabTextarea } from '@labpics/ui-core/textarea';
/** SSR-пропы <lab-textarea> (атрибуты/свойства), взяты из класса ядра (LabTextarea). */
export type TextareaSsrProps = Partial<Pick<LabTextarea, 'type' | 'size' | 'label' | 'labelHidden' | 'helper' | 'error' | 'value' | 'placeholder' | 'rows' | 'autoResize' | 'readonly' | 'disabled' | 'required' | 'invalid' | 'name'>>;
/** SSR-слоты <lab-textarea> — предрендеренные строки контента. */
export type TextareaSsrSlots = Record<never, never>;
/**
 * Рендерит <lab-textarea> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export declare function renderTextarea(props?: TextareaSsrProps): string;
//# sourceMappingURL=textarea.ssr.d.ts.map