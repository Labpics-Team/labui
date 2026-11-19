/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/icon';
import type { LabIcon } from '@labpics/ui-core/icon';

/** SSR-пропы <lab-icon> (атрибуты/свойства), взяты из класса ядра (LabIcon). */
export type IconSsrProps = Partial<Pick<LabIcon, 'symbol' | 'variant' | 'size' | 'scale' | 'weight' | 'opsz' | 'state' | 'date' | 'timeZone' | 'duration' | 'reducedMotion' | 'effect' | 'effectKey' | 'label'>> & { 'aria-label'?: string; 'form'?: string };
/** SSR-слоты <lab-icon> — предрендеренные строки контента. */
export type IconSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-icon> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderIcon(
  props: IconSsrProps = {},
): string {
  return renderToString(html`<lab-icon
      .symbol=${props.symbol === undefined ? noChange : props.symbol}
      variant=${ifDefined(props.variant)}
      .size=${props.size === undefined ? noChange : props.size}
      .scale=${props.scale === undefined ? noChange : props.scale}
      weight=${ifDefined(props.weight)}
      .opsz=${props.opsz === undefined ? noChange : props.opsz}
      state=${ifDefined(props.state)}
      .date=${props.date === undefined ? noChange : props.date}
      time-zone=${ifDefined(props.timeZone)}
      duration=${ifDefined(props.duration)}
      .reducedMotion=${props.reducedMotion === undefined ? noChange : props.reducedMotion}
      effect=${ifDefined(props.effect)}
      .effectKey=${props.effectKey === undefined ? noChange : props.effectKey}
      label=${ifDefined(props.label)}
      aria-label=${ifDefined(props['aria-label'])}
      form=${ifDefined(props['form'])}
    ></lab-icon>`);
}
