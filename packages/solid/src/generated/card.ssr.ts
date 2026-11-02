/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange, unsafeHTML } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/card';
import type { LabCard } from '@labpics/ui-core/card';

/** SSR-пропы <lab-card> (атрибуты/свойства), взяты из класса ядра (LabCard). */
export type CardSsrProps = Partial<Pick<LabCard, 'variant' | 'padding' | 'interactive'>>;
/** SSR-слоты <lab-card> — предрендеренные строки контента. */
export type CardSsrSlots = { default?: string; footer?: string; header?: string; media?: string };

/**
 * Рендерит <lab-card> со стилями и Declarative Shadow DOM. Включите строку в
 * серверный ответ через v-html / {@html} / set:html либо серверный HTML-шаблон.
 * Обычная клиентская вставка innerHTML не создаёт declarative shadow root.
 */
export function renderCard(
  props: CardSsrProps = {},
  slots: CardSsrSlots = {},
): string {
  return renderToString(html`<lab-card
      variant=${ifDefined(props.variant)}
      padding=${ifDefined(props.padding)}
      .interactive=${props.interactive === undefined ? noChange : Boolean(props.interactive)}
    >${slots.footer ? html`<span slot="footer">${unsafeHTML(slots.footer)}</span>` : ''}${slots.header ? html`<span slot="header">${unsafeHTML(slots.header)}</span>` : ''}${slots.media ? html`<span slot="media">${unsafeHTML(slots.media)}</span>` : ''}${unsafeHTML(slots.default ?? '')}</lab-card>`);
}
