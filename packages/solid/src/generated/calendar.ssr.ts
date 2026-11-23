/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/calendar';
import type { LabCalendar } from '@labpics/ui-core/calendar';

/** SSR-пропы <lab-calendar> (атрибуты/свойства), взяты из класса ядра (LabCalendar). */
export type CalendarSsrProps = Partial<Pick<LabCalendar, 'dir' | 'size' | 'selection' | 'value' | 'defaultValue' | 'month' | 'defaultMonth' | 'locale' | 'firstDayOfWeek' | 'today' | 'min' | 'max' | 'disabled' | 'readonly' | 'required' | 'name' | 'label' | 'events' | 'markers' | 'isDateUnavailable' | 'unavailableDates' | 'translations'>> & { 'aria-label'?: string; 'form'?: string };
/** SSR-слоты <lab-calendar> — предрендеренные строки контента. */
export type CalendarSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-calendar> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderCalendar(
  props: CalendarSsrProps = {},
): string {
  return renderToString(html`<lab-calendar
      dir=${ifDefined(props.dir)}
      size=${ifDefined(props.size)}
      selection=${ifDefined(props.selection)}
      .value=${props.value === undefined ? noChange : props.value}
      .defaultValue=${props.defaultValue === undefined ? noChange : props.defaultValue}
      month=${ifDefined(props.month)}
      default-month=${ifDefined(props.defaultMonth)}
      locale=${ifDefined(props.locale)}
      first-day-of-week=${ifDefined(props.firstDayOfWeek)}
      today=${ifDefined(props.today)}
      min=${ifDefined(props.min)}
      max=${ifDefined(props.max)}
      .disabled=${props.disabled === undefined ? noChange : props.disabled}
      .readonly=${props.readonly === undefined ? noChange : props.readonly}
      .required=${props.required === undefined ? noChange : props.required}
      name=${ifDefined(props.name)}
      label=${ifDefined(props.label)}
      .events=${props.events === undefined ? noChange : props.events}
      .markers=${props.markers === undefined ? noChange : props.markers}
      .isDateUnavailable=${props.isDateUnavailable === undefined ? noChange : props.isDateUnavailable}
      .unavailableDates=${props.unavailableDates === undefined ? noChange : props.unavailableDates}
      .translations=${props.translations === undefined ? noChange : props.translations}
      aria-label=${ifDefined(props['aria-label'])}
      form=${ifDefined(props['form'])}
    ></lab-calendar>`);
}
