/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, unsafeHTML } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/popover';
/**
 * Рендерит <lab-popover> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderPopover(props = {}, slots = {}) {
    return renderToString(html `<lab-popover
      placement=${ifDefined(props.placement)}
      size=${ifDefined(props.size)}
      ?modal=${Boolean(props.modal)}
      ?closable=${Boolean(props.closable)}
      ?arrow=${Boolean(props.arrow)}
      heading=${ifDefined(props.heading)}
      description=${ifDefined(props.description)}
    >${slots.content ? html `<span slot="content">${unsafeHTML(slots.content)}</span>` : ''}${unsafeHTML(slots.default ?? '')}</lab-popover>`);
}
