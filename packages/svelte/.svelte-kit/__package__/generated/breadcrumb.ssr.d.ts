import '@labpics/ui-core/breadcrumb';
import type { LabBreadcrumb } from '@labpics/ui-core/breadcrumb';
/** SSR-пропы <lab-breadcrumb> (атрибуты/свойства), взяты из класса ядра (LabBreadcrumb). */
export type BreadcrumbSsrProps = Partial<Pick<LabBreadcrumb, 'size' | 'separator' | 'items'>>;
/** SSR-слоты <lab-breadcrumb> — предрендеренные строки контента. */
export type BreadcrumbSsrSlots = Record<never, never>;
/**
 * Рендерит <lab-breadcrumb> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export declare function renderBreadcrumb(props?: BreadcrumbSsrProps): string;
//# sourceMappingURL=breadcrumb.ssr.d.ts.map