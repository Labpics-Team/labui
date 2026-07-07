import '@labpics/ui-core/breadcrumb';
import type { LabBreadcrumb } from '@labpics/ui-core/breadcrumb';
import type { Snippet } from 'svelte';
/** Пропы <lab-breadcrumb> — типы взяты прямо из класса ядра (LabBreadcrumb). */
interface Props {
    size?: LabBreadcrumb['size'];
    separator?: LabBreadcrumb['separator'];
    items?: LabBreadcrumb['items'];
    children?: Snippet;
    [key: string]: unknown;
}
declare const Breadcrumb: import("svelte").Component<Props, {}, "">;
type Breadcrumb = ReturnType<typeof Breadcrumb>;
export default Breadcrumb;
//# sourceMappingURL=Breadcrumb.svelte.d.ts.map