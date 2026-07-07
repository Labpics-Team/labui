import '@labpics/ui-core/pagination';
import type { LabPagination } from '@labpics/ui-core/pagination';
import type { Snippet } from 'svelte';
/** Пропы <lab-pagination> — типы взяты прямо из класса ядра (LabPagination). */
interface Props {
    size?: LabPagination['size'];
    count?: LabPagination['count'];
    pageSize?: LabPagination['pageSize'];
    siblingCount?: LabPagination['siblingCount'];
    page?: LabPagination['page'];
    defaultPage?: LabPagination['defaultPage'];
    onPageChange?: (event: CustomEvent) => void;
    children?: Snippet;
    [key: string]: unknown;
}
declare const Pagination: import("svelte").Component<Props, {}, "">;
type Pagination = ReturnType<typeof Pagination>;
export default Pagination;
//# sourceMappingURL=Pagination.svelte.d.ts.map