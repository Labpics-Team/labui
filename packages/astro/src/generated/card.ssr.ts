/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange, unsafeHTML, slotProjectionShadowHtml } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/card';
import type { LabCard } from '@labpics/ui-core/card';

/** SSR-пропы <lab-card> (атрибуты/свойства), взяты из класса ядра (LabCard). */
export type CardSsrProps = Partial<Pick<LabCard, 'variant' | 'padding' | 'interactive' | 'image' | 'imageAlt' | 'heading' | 'headingHint' | 'description' | 'caption' | 'lowerCaption'>> & { 'aria-label'?: string; 'form'?: string };
/** SSR-слоты <lab-card> — предрендеренные строки контента. */
export type CardSsrSlots = { default?: string; badge?: string; footer?: string; header?: string; media?: string };

/**
 * Рендерит <lab-card> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderCard(
  props: CardSsrProps = {},
  slots: CardSsrSlots = {},
): string {
  return renderToString(html`<lab-card
      variant=${ifDefined(props.variant)}
      padding=${ifDefined(props.padding)}
      .interactive=${props.interactive === undefined ? noChange : props.interactive}
      image=${ifDefined(props.image)}
      image-alt=${ifDefined(props.imageAlt)}
      heading=${ifDefined(props.heading)}
      heading-hint=${ifDefined(props.headingHint)}
      description=${ifDefined(props.description)}
      caption=${ifDefined(props.caption)}
      lower-caption=${ifDefined(props.lowerCaption)}
      aria-label=${ifDefined(props['aria-label'])}
      form=${ifDefined(props['form'])}
    >${slots.badge ? html`<lab-slot slot="badge">${unsafeHTML(slotProjectionShadowHtml)}${unsafeHTML(slots.badge)}</lab-slot>` : ''}${slots.footer ? html`<lab-slot slot="footer">${unsafeHTML(slotProjectionShadowHtml)}${unsafeHTML(slots.footer)}</lab-slot>` : ''}${slots.header ? html`<lab-slot slot="header">${unsafeHTML(slotProjectionShadowHtml)}${unsafeHTML(slots.header)}</lab-slot>` : ''}${slots.media ? html`<lab-slot slot="media">${unsafeHTML(slotProjectionShadowHtml)}${unsafeHTML(slots.media)}</lab-slot>` : ''}${unsafeHTML(slots.default ?? '')}</lab-card>`);
}
