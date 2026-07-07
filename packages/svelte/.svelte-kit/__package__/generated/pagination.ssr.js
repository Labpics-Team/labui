/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/pagination';
/**
 * Рендерит <lab-pagination> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderPagination(props = {}) {
    return renderToString(html `<lab-pagination
      size=${ifDefined(props.size)}
      count=${ifDefined(props.count)}
      page-size=${ifDefined(props.pageSize)}
      sibling-count=${ifDefined(props.siblingCount)}
      page=${ifDefined(props.page)}
      default-page=${ifDefined(props.defaultPage)}
    ></lab-pagination>`);
}
