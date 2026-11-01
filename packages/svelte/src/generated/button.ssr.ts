/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, unsafeHTML } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/button';
import type { LabButton } from '@labpics/ui-core/button';

/** SSR-пропы <lab-button> (атрибуты/свойства), взяты из класса ядра (LabButton). */
export type ButtonSsrProps = Partial<Pick<LabButton, 'type' | 'kind' | 'size' | 'description' | 'icon' | 'loading' | 'disabled' | 'htmlType'>>;
/** SSR-слоты <lab-button> — предрендеренные строки контента. */
export type ButtonSsrSlots = { default?: string; end?: string; icon?: string };

/**
 * Рендерит <lab-button> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderButton(
  props: ButtonSsrProps = {},
  slots: ButtonSsrSlots = {},
): string {
  return renderToString(html`<lab-button
      type=${ifDefined(props.type)}
      kind=${ifDefined(props.kind)}
      size=${ifDefined(props.size)}
      description=${ifDefined(props.description)}
      ?icon=${Boolean(props.icon)}
      ?loading=${Boolean(props.loading)}
      ?disabled=${Boolean(props.disabled)}
      html-type=${ifDefined(props.htmlType)}
    >${slots.end ? html`<span slot="end">${unsafeHTML(slots.end)}</span>` : ''}${slots.icon ? html`<span slot="icon">${unsafeHTML(slots.icon)}</span>` : ''}${unsafeHTML(slots.default ?? '')}</lab-button>`);
}
