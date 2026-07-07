import '@labpics/ui-core/tags-input';
import type { LabTagsInput } from '@labpics/ui-core/tags-input';
/** SSR-пропы <lab-tags-input> (атрибуты/свойства), взяты из класса ядра (LabTagsInput). */
export type TagsInputSsrProps = Partial<Pick<LabTagsInput, 'type' | 'size' | 'label' | 'labelHidden' | 'helper' | 'error' | 'placeholder' | 'max' | 'delimiter' | 'editable' | 'addOnPaste' | 'allowDuplicates' | 'value' | 'defaultValue' | 'readonly' | 'disabled' | 'required' | 'invalid' | 'name'>>;
/** SSR-слоты <lab-tags-input> — предрендеренные строки контента. */
export type TagsInputSsrSlots = Record<never, never>;
/**
 * Рендерит <lab-tags-input> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export declare function renderTagsInput(props?: TagsInputSsrProps): string;
//# sourceMappingURL=tags-input.ssr.d.ts.map