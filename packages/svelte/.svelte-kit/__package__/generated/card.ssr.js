/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, unsafeHTML } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/card';
/**
 * Рендерит <lab-card> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderCard(props = {}, slots = {}) {
    return renderToString(html `<lab-card
      variant=${ifDefined(props.variant)}
      padding=${ifDefined(props.padding)}
      ?interactive=${Boolean(props.interactive)}
    >${slots.footer ? html `<span slot="footer">${unsafeHTML(slots.footer)}</span>` : ''}${slots.header ? html `<span slot="header">${unsafeHTML(slots.header)}</span>` : ''}${slots.media ? html `<span slot="media">${unsafeHTML(slots.media)}</span>` : ''}${unsafeHTML(slots.default ?? '')}</lab-card>`);
}
