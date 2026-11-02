/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange, unsafeHTML } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/button';
import type { LabButton } from '@labpics/ui-core/button';

/** SSR-пропы <lab-button> (атрибуты/свойства), взяты из класса ядра (LabButton). */
export type ButtonSsrProps = Partial<Pick<LabButton, 'type' | 'kind' | 'size' | 'description' | 'icon' | 'loading' | 'disabled' | 'htmlType'>>;
/** SSR-слоты <lab-button> — предрендеренные строки контента. */
export type ButtonSsrSlots = { default?: string; end?: string; icon?: string };

/**
 * Рендерит <lab-button> со стилями и Declarative Shadow DOM. Включите строку в
 * серверный ответ через v-html / {@html} / set:html либо серверный HTML-шаблон.
 * Обычная клиентская вставка innerHTML не создаёт declarative shadow root.
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
      .icon=${props.icon === undefined ? noChange : Boolean(props.icon)}
      .loading=${props.loading === undefined ? noChange : Boolean(props.loading)}
      .disabled=${props.disabled === undefined ? noChange : Boolean(props.disabled)}
      html-type=${ifDefined(props.htmlType)}
    >${slots.end ? html`<span slot="end">${unsafeHTML(slots.end)}</span>` : ''}${slots.icon ? html`<span slot="icon">${unsafeHTML(slots.icon)}</span>` : ''}${unsafeHTML(slots.default ?? '')}</lab-button>`);
}
