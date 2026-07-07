/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/progress';
import type { LabProgress } from '@labpics/ui-core/progress';

/** SSR-пропы <lab-progress> (атрибуты/свойства), взяты из класса ядра (LabProgress). */
export type ProgressSsrProps = Partial<Pick<LabProgress, 'size' | 'value' | 'min' | 'max' | 'label' | 'showValueText'>>;
/** SSR-слоты <lab-progress> — предрендеренные строки контента. */
export type ProgressSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-progress> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderProgress(
  props: ProgressSsrProps = {},
): string {
  return renderToString(html`<lab-progress
      size=${ifDefined(props.size)}
      .value=${props.value}
      min=${ifDefined(props.min)}
      max=${ifDefined(props.max)}
      label=${ifDefined(props.label)}
      ?show-value-text=${Boolean(props.showValueText)}
    ></lab-progress>`);
}
