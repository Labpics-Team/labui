/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange, unsafeHTML } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/badge';
import type { LabBadge } from '@labpics/ui-core/badge';

/** SSR-пропы <lab-badge> (атрибуты/свойства), взяты из класса ядра (LabBadge). */
export type BadgeSsrProps = Partial<Pick<LabBadge, 'color' | 'type' | 'disabled'>>;
/** SSR-слоты <lab-badge> — предрендеренные строки контента. */
export type BadgeSsrSlots = { default?: string; dot?: string; leading?: string; trailing?: string };

/**
 * Рендерит <lab-badge> со стилями и Declarative Shadow DOM. Включите строку в
 * серверный ответ через v-html / {@html} / set:html либо серверный HTML-шаблон.
 * Обычная клиентская вставка innerHTML не создаёт declarative shadow root.
 */
export function renderBadge(
  props: BadgeSsrProps = {},
  slots: BadgeSsrSlots = {},
): string {
  return renderToString(html`<lab-badge
      color=${ifDefined(props.color)}
      type=${ifDefined(props.type)}
      .disabled=${props.disabled === undefined ? noChange : Boolean(props.disabled)}
    >${slots.dot || slots.leading || slots.trailing ? html`<style slot="_lab-style">:where([data-lab-slot-fill]) > *{inline-size:100%;block-size:100%}[data-lab-slot-fill]:empty{display:none!important}</style>` : ''}${slots.dot ? html`<span slot="dot" data-lab-slot-fill style="display:inline-flex">${unsafeHTML(slots.dot)}</span>` : ''}${slots.leading ? html`<span slot="leading" data-lab-slot-fill style="display:inline-flex">${unsafeHTML(slots.leading)}</span>` : ''}${slots.trailing ? html`<span slot="trailing" data-lab-slot-fill style="display:inline-flex">${unsafeHTML(slots.trailing)}</span>` : ''}${unsafeHTML(slots.default ?? '')}</lab-badge>`);
}
