/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/menu';
import type { LabMenu } from '@labpics/ui-core/menu';

/** SSR-пропы <lab-menu> (атрибуты/свойства), взяты из класса ядра (LabMenu). */
export type MenuSsrProps = Partial<Pick<LabMenu, 'size' | 'placement' | 'disabled' | 'label' | 'items'>>;
/** SSR-слоты <lab-menu> — предрендеренные строки контента. */
export type MenuSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-menu> со стилями и Declarative Shadow DOM. Включите строку в
 * серверный ответ через v-html / {@html} / set:html либо серверный HTML-шаблон.
 * Обычная клиентская вставка innerHTML не создаёт declarative shadow root.
 */
export function renderMenu(
  props: MenuSsrProps = {},
): string {
  return renderToString(html`<lab-menu
      size=${ifDefined(props.size)}
      placement=${ifDefined(props.placement)}
      .disabled=${props.disabled === undefined ? noChange : Boolean(props.disabled)}
      label=${ifDefined(props.label)}
      .items=${props.items === undefined ? noChange : props.items}
    ></lab-menu>`);
}
