/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, unsafeHTML } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/badge';
import type { LabBadge } from '@labpics/ui-core/badge';

/** SSR-пропы <lab-badge> (атрибуты/свойства), взяты из класса ядра (LabBadge). */
export type BadgeSsrProps = Partial<Pick<LabBadge, 'color' | 'type' | 'disabled'>>;
/** SSR-слоты <lab-badge> — предрендеренные строки контента. */
export type BadgeSsrSlots = { default?: string; dot?: string; leading?: string; trailing?: string };

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
      ?disabled=${Boolean(props.disabled)}
    >${slots.dot || slots.leading || slots.trailing ? html`<style slot="_lab-style">:where([data-lab-slot-fill]) > *{inline-size:100%;block-size:100%}[data-lab-slot-fill]:empty{display:none!important}</style>` : ''}${slots.dot ? html`<span slot="dot" data-lab-slot-fill style="display:inline-flex">${unsafeHTML(slots.dot)}</span>` : ''}${slots.leading ? html`<span slot="leading" data-lab-slot-fill style="display:inline-flex">${unsafeHTML(slots.leading)}</span>` : ''}${slots.trailing ? html`<span slot="trailing" data-lab-slot-fill style="display:inline-flex">${unsafeHTML(slots.trailing)}</span>` : ''}${unsafeHTML(slots.default ?? '')}</lab-badge>`);
}
