/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/pagination';
import type { LabPagination } from '@labpics/ui-core/pagination';

/** SSR-пропы <lab-pagination> (атрибуты/свойства), взяты из класса ядра (LabPagination). */
export type PaginationSsrProps = Partial<Pick<LabPagination, 'count' | 'pageSize' | 'page' | 'defaultPage' | 'siblingCount' | 'variant' | 'disabled' | 'ambient' | 'progress' | 'href' | 'label' | 'previousLabel' | 'nextLabel' | 'pageLabel'>> & { 'aria-label'?: string; 'form'?: string };
/** SSR-слоты <lab-pagination> — предрендеренные строки контента. */
export type PaginationSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-pagination> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderPagination(
  props: PaginationSsrProps = {},
): string {
  return renderToString(html`<lab-pagination
      count=${ifDefined(props.count)}
      page-size=${ifDefined(props.pageSize)}
      .page=${props.page === undefined ? noChange : props.page}
      default-page=${ifDefined(props.defaultPage)}
      sibling-count=${ifDefined(props.siblingCount)}
      variant=${ifDefined(props.variant)}
      ?disabled=${Boolean(props.disabled)}
      ?ambient=${Boolean(props.ambient)}
      .progress=${props.progress === undefined ? noChange : props.progress}
      href=${ifDefined(props.href)}
      label=${ifDefined(props.label)}
      previous-label=${ifDefined(props.previousLabel)}
      next-label=${ifDefined(props.nextLabel)}
      page-label=${ifDefined(props.pageLabel)}
      aria-label=${ifDefined(props['aria-label'])}
      form=${ifDefined(props['form'])}
    ></lab-pagination>`);
}
