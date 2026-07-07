/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, unsafeHTML } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/tooltip';
/**
 * Рендерит <lab-tooltip> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderTooltip(props = {}, slots = {}) {
    return renderToString(html `<lab-tooltip
      placement=${ifDefined(props.placement)}
      size=${ifDefined(props.size)}
      content=${ifDefined(props.content)}
      open-delay=${ifDefined(props.openDelay)}
      close-delay=${ifDefined(props.closeDelay)}
      ?disabled=${Boolean(props.disabled)}
      ?arrow=${Boolean(props.arrow)}
    >${slots.content ? html `<span slot="content">${unsafeHTML(slots.content)}</span>` : ''}${unsafeHTML(slots.default ?? '')}</lab-tooltip>`);
}
