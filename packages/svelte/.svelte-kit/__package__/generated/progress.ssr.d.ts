import '@labpics/ui-core/progress';
import type { LabProgress } from '@labpics/ui-core/progress';
/** SSR-пропы <lab-progress> (атрибуты/свойства), взяты из класса ядра (LabProgress). */
export type ProgressSsrProps = Partial<Pick<LabProgress, 'size' | 'value' | 'min' | 'max' | 'label' | 'showValueText'>>;
/** SSR-слоты <lab-progress> — предрендеренные строки контента. */
export type ProgressSsrSlots = Record<never, never>;
/**
 * Рендерит <lab-progress> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export declare function renderProgress(props?: ProgressSsrProps): string;
//# sourceMappingURL=progress.ssr.d.ts.map