/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/tabs';
/**
 * Рендерит <lab-tabs> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderTabs(props = {}) {
    return renderToString(html `<lab-tabs
      orientation=${ifDefined(props.orientation)}
      size=${ifDefined(props.size)}
      activation-mode=${ifDefined(props.activationMode)}
      value=${ifDefined(props.value)}
      default-value=${ifDefined(props.defaultValue)}
      .items=${props.items}
    ></lab-tabs>`);
}
