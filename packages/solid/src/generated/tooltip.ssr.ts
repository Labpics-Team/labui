/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange, unsafeHTML } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/tooltip';
import type { LabTooltip } from '@labpics/ui-core/tooltip';

/** SSR-пропы <lab-tooltip> (атрибуты/свойства), взяты из класса ядра (LabTooltip). */
export type TooltipSsrProps = Partial<Pick<LabTooltip, 'placement' | 'size' | 'content' | 'openDelay' | 'closeDelay' | 'disabled' | 'arrow'>>;
/** SSR-слоты <lab-tooltip> — предрендеренные строки контента. */
export type TooltipSsrSlots = { default?: string; content?: string };

/**
 * Рендерит <lab-tooltip> со стилями и Declarative Shadow DOM. Включите строку в
 * серверный ответ через v-html / {@html} / set:html либо серверный HTML-шаблон.
 * Обычная клиентская вставка innerHTML не создаёт declarative shadow root.
 */
export function renderTooltip(
  props: TooltipSsrProps = {},
  slots: TooltipSsrSlots = {},
): string {
  return renderToString(html`<lab-tooltip
      placement=${ifDefined(props.placement)}
      size=${ifDefined(props.size)}
      content=${ifDefined(props.content)}
      open-delay=${ifDefined(props.openDelay)}
      close-delay=${ifDefined(props.closeDelay)}
      .disabled=${props.disabled === undefined ? noChange : Boolean(props.disabled)}
      .arrow=${props.arrow === undefined ? noChange : Boolean(props.arrow)}
    >${slots.content ? html`<span slot="content">${unsafeHTML(slots.content)}</span>` : ''}${unsafeHTML(slots.default ?? '')}</lab-tooltip>`);
}
