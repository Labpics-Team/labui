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
export type BadgeSsrProps = Partial<Pick<LabBadge, 'color' | 'type' | 'disabled'>> & { 'aria-label'?: string; 'form'?: string };
/** SSR-слоты <lab-badge> — предрендеренные строки контента. */
export type BadgeSsrSlots = { default?: string; dot?: string; icon?: string; iconEnd?: string };

/**
 * Рендерит <lab-badge> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderBadge(
  props: BadgeSsrProps = {},
  slots: BadgeSsrSlots = {},
): string {
  return renderToString(html`<lab-badge
      color=${ifDefined(props.color)}
      type=${ifDefined(props.type)}
      .disabled=${props.disabled === undefined ? noChange : props.disabled}
      aria-label=${ifDefined(props['aria-label'])}
      form=${ifDefined(props['form'])}
    >${slots.dot ? html`<span slot="dot">${unsafeHTML(slots.dot)}</span>` : ''}${slots.icon ? html`<span slot="icon">${unsafeHTML(slots.icon)}</span>` : ''}${slots.iconEnd ? html`<span slot="icon-end">${unsafeHTML(slots.iconEnd)}</span>` : ''}${unsafeHTML(slots.default ?? '')}</lab-badge>`);
}
