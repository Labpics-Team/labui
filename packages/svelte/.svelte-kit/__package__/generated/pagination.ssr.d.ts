import '@labpics/ui-core/pagination';
import type { LabPagination } from '@labpics/ui-core/pagination';
/** SSR-пропы <lab-pagination> (атрибуты/свойства), взяты из класса ядра (LabPagination). */
export type PaginationSsrProps = Partial<Pick<LabPagination, 'size' | 'count' | 'pageSize' | 'siblingCount' | 'page' | 'defaultPage'>>;
/** SSR-слоты <lab-pagination> — предрендеренные строки контента. */
export type PaginationSsrSlots = Record<never, never>;
/**
 * Рендерит <lab-pagination> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export declare function renderPagination(props?: PaginationSsrProps): string;
//# sourceMappingURL=pagination.ssr.d.ts.map