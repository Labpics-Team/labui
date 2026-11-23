/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { type LabSolidComponent, createLabComponent } from '../runtime/create-lab-component.js';
import '@labpics/ui-core/calendar';
import type { LabCalendar } from '@labpics/ui-core/calendar';

/** Пропы <lab-calendar>, взятые прямо из класса ядра (LabCalendar). */
export type CalendarProps = Pick<LabCalendar, 'dir' | 'size' | 'selection' | 'value' | 'defaultValue' | 'month' | 'defaultMonth' | 'locale' | 'firstDayOfWeek' | 'today' | 'min' | 'max' | 'disabled' | 'readonly' | 'required' | 'name' | 'label' | 'events' | 'markers' | 'isDateUnavailable' | 'unavailableDates' | 'translations'>;

/** <Calendar> — тонкая Solid-обёртка над <lab-calendar>. */
export const Calendar: LabSolidComponent<CalendarProps, 'month-change' | 'value-change'> = createLabComponent<
  CalendarProps,
  'month-change' | 'value-change'
>('lab-calendar', {
  specs: [
    { name: 'dir', attr: 'dir', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'selection', attr: 'selection', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'prop' },
    { name: 'defaultValue', attr: 'defaultValue', kind: 'prop' },
    { name: 'month', attr: 'month', kind: 'string' },
    { name: 'defaultMonth', attr: 'default-month', kind: 'string' },
    { name: 'locale', attr: 'locale', kind: 'string' },
    { name: 'firstDayOfWeek', attr: 'first-day-of-week', kind: 'string' },
    { name: 'today', attr: 'today', kind: 'string' },
    { name: 'min', attr: 'min', kind: 'string' },
    { name: 'max', attr: 'max', kind: 'string' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'readonly', attr: 'readonly', kind: 'boolean' },
    { name: 'required', attr: 'required', kind: 'boolean' },
    { name: 'name', attr: 'name', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'events', attr: 'events', kind: 'prop' },
    { name: 'markers', attr: 'markers', kind: 'prop' },
    { name: 'isDateUnavailable', attr: 'isDateUnavailable', kind: 'prop' },
    { name: 'unavailableDates', attr: 'unavailableDates', kind: 'prop' },
    { name: 'translations', attr: 'translations', kind: 'prop' },
  ],
  events: ['month-change', 'value-change'],
});
