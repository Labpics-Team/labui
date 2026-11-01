/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, unsafeHTML } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/card';
import type { LabCard } from '@labpics/ui-core/card';

/** SSR-пропы <lab-card> (атрибуты/свойства), взяты из класса ядра (LabCard). */
export type CardSsrProps = Partial<Pick<LabCard, 'variant' | 'padding' | 'interactive' | 'imageSrc' | 'imageAlt' | 'heading' | 'headingLevel' | 'caption' | 'description' | 'lowerCaption' | 'titleHint' | 'badge'>>;
/** SSR-слоты <lab-card> — предрендеренные строки контента. */
export type CardSsrSlots = { default?: string; footer?: string; header?: string; media?: string };

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
      ?interactive=${Boolean(props.interactive)}
      image-src=${ifDefined(props.imageSrc)}
      image-alt=${ifDefined(props.imageAlt)}
      heading=${ifDefined(props.heading)}
      heading-level=${ifDefined(props.headingLevel)}
      caption=${ifDefined(props.caption)}
      description=${ifDefined(props.description)}
      lower-caption=${ifDefined(props.lowerCaption)}
      title-hint=${ifDefined(props.titleHint)}
      badge=${ifDefined(props.badge)}
    >${slots.footer ? html`<span slot="footer">${unsafeHTML(slots.footer)}</span>` : ''}${slots.header ? html`<span slot="header">${unsafeHTML(slots.header)}</span>` : ''}${slots.media ? html`<span slot="media">${unsafeHTML(slots.media)}</span>` : ''}${unsafeHTML(slots.default ?? '')}</lab-card>`);
}
