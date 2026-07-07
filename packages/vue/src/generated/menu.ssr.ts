/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/menu';
import type { LabMenu } from '@labpics/ui-core/menu';

/** SSR-пропы <lab-menu> (атрибуты/свойства), взяты из класса ядра (LabMenu). */
export type MenuSsrProps = Partial<Pick<LabMenu, 'size' | 'placement' | 'disabled' | 'label' | 'items'>>;
/** SSR-слоты <lab-menu> — предрендеренные строки контента. */
export type MenuSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-menu> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderMenu(
  props: MenuSsrProps = {},
): string {
  return renderToString(html`<lab-menu
      size=${ifDefined(props.size)}
      placement=${ifDefined(props.placement)}
      ?disabled=${Boolean(props.disabled)}
      label=${ifDefined(props.label)}
      .items=${props.items}
    ></lab-menu>`);
}
