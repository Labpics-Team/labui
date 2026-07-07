/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/radio-group';
/**
 * Рендерит <lab-radio-group> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderRadioGroup(props = {}) {
    return renderToString(html `<lab-radio-group
      type=${ifDefined(props.type)}
      size=${ifDefined(props.size)}
      orientation=${ifDefined(props.orientation)}
      value=${ifDefined(props.value)}
      default-value=${ifDefined(props.defaultValue)}
      ?disabled=${Boolean(props.disabled)}
      name=${ifDefined(props.name)}
      label=${ifDefined(props.label)}
      .items=${props.items}
    ></lab-radio-group>`);
}
