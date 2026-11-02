/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/breadcrumb';
import type { LabBreadcrumb } from '@labpics/ui-core/breadcrumb';

/** SSR-пропы <lab-breadcrumb> (атрибуты/свойства), взяты из класса ядра (LabBreadcrumb). */
export type BreadcrumbSsrProps = Partial<Pick<LabBreadcrumb, 'size' | 'separator' | 'items'>>;
/** SSR-слоты <lab-breadcrumb> — предрендеренные строки контента. */
export type BreadcrumbSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-breadcrumb> со стилями и Declarative Shadow DOM. Включите строку в
 * серверный ответ через v-html / {@html} / set:html либо серверный HTML-шаблон.
 * Обычная клиентская вставка innerHTML не создаёт declarative shadow root.
 */
export function renderBreadcrumb(
  props: BreadcrumbSsrProps = {},
): string {
  return renderToString(html`<lab-breadcrumb
      size=${ifDefined(props.size)}
      separator=${ifDefined(props.separator)}
      .items=${props.items}
    ></lab-breadcrumb>`);
}
