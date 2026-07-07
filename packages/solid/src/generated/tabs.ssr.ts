/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/tabs';
import type { LabTabs } from '@labpics/ui-core/tabs';

/** SSR-пропы <lab-tabs> (атрибуты/свойства), взяты из класса ядра (LabTabs). */
export type TabsSsrProps = Partial<Pick<LabTabs, 'orientation' | 'size' | 'activationMode' | 'value' | 'defaultValue' | 'items'>>;
/** SSR-слоты <lab-tabs> — предрендеренные строки контента. */
export type TabsSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-tabs> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderTabs(
  props: TabsSsrProps = {},
): string {
  return renderToString(html`<lab-tabs
      orientation=${ifDefined(props.orientation)}
      size=${ifDefined(props.size)}
      activation-mode=${ifDefined(props.activationMode)}
      value=${ifDefined(props.value)}
      default-value=${ifDefined(props.defaultValue)}
      .items=${props.items}
    ></lab-tabs>`);
}
