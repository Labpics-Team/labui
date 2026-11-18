/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/loader';
import type { LabLoader } from '@labpics/ui-core/loader';

/** SSR-пропы <lab-loader> (атрибуты/свойства), взяты из класса ядра (LabLoader). */
export type LoaderSsrProps = Partial<Pick<LabLoader, 'size' | 'label' | 'value' | 'min' | 'max'>>;
/** SSR-слоты <lab-loader> — предрендеренные строки контента. */
export type LoaderSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-loader> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderLoader(
  props: LoaderSsrProps = {},
): string {
  return renderToString(html`<lab-loader
      size=${ifDefined(props.size)}
      label=${ifDefined(props.label)}
      .value=${props.value === undefined ? noChange : props.value}
      min=${ifDefined(props.min)}
      max=${ifDefined(props.max)}
    ></lab-loader>`);
}
