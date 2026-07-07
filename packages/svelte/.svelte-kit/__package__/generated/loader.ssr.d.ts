import '@labpics/ui-core/loader';
import type { LabLoader } from '@labpics/ui-core/loader';
/** SSR-пропы <lab-loader> (атрибуты/свойства), взяты из класса ядра (LabLoader). */
export type LoaderSsrProps = Partial<Pick<LabLoader, 'size' | 'label'>>;
/** SSR-слоты <lab-loader> — предрендеренные строки контента. */
export type LoaderSsrSlots = Record<never, never>;
/**
 * Рендерит <lab-loader> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export declare function renderLoader(props?: LoaderSsrProps): string;
//# sourceMappingURL=loader.ssr.d.ts.map