import {
  type CalendarDate,
  type DayOfWeek,
  getDayOfWeek,
  parseDate,
  today,
} from '@internationalized/date';

export type LabCalendarSize = 's' | 'm';
export type LabCalendarSelection = 'single' | 'range';
export interface CalendarEvents {
  count: number;
  label?: string;
}
export interface CalendarChangeDetails {
  value: string[];
}
export interface CalendarMonthChangeDetails {
  month: string;
}
export interface CalendarTranslations {
  previousMonth: string;
  nextMonth: string;
  /** A serializable {count} template, or a client-only pluralization callback. */
  events: string | ((count: number) => string);
  marker: string;
  requiredSelection: string;
}
export const calendarTranslations: CalendarTranslations = {
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  events: (count) => `${count} ${count === 1 ? 'event' : 'events'}`,
  marker: 'Marked',
  requiredSelection: 'Choose a date or complete the date range.',
};
export interface CalendarOptions {
  selection?: LabCalendarSelection;
  locale?: string;
  firstDayOfWeek?: number;
  today?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  readOnly?: boolean;
  isDateUnavailable?: (date: string) => boolean;
  unavailableDates?: readonly string[];
  events?: Record<string, CalendarEvents | number>;
  markers?: readonly string[];
  translations?: Partial<CalendarTranslations>;
}

/** ISO Gregorian date-only. Time, UTC offsets and implicit string parsing are rejected. */
export function calendarDate(value: string): CalendarDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-'))
    throw new RangeError(`Expected an ISO date (YYYY-MM-DD), received ${value}`);
  return parseDate(value);
}
export function calendarToday(): string {
  return today('UTC').toString();
}
export function calendarMonth(value: string): string {
  return calendarDate(value).set({ day: 1 }).toString();
}
export function calendarValue(
  value: readonly string[],
  selection: LabCalendarSelection = 'single',
): string[] {
  if (value.length > (selection === 'range' ? 2 : 1))
    throw new RangeError('Too many calendar dates');
  const dates = value.map((date) => calendarDate(date).toString());
  return selection === 'range' ? dates.sort() : dates;
}
export function calendarFocus(focus: string, month: string, options: CalendarOptions): string {
  let date = calendarDate(focus);
  const shown = calendarDate(month);
  if (calendarMonth(focus) !== calendarMonth(month)) date = shown.set({ day: date.day });
  if (
    options.min &&
    calendarMonth(options.min) === calendarMonth(month) &&
    date.compare(calendarDate(options.min)) < 0
  )
    date = calendarDate(options.min);
  if (
    options.max &&
    calendarMonth(options.max) === calendarMonth(month) &&
    date.compare(calendarDate(options.max)) > 0
  )
    date = calendarDate(options.max);
  return date.toString();
}
export function calendarAvailable(date: string, options: CalendarOptions): boolean {
  return (
    !(options.min && date < options.min) &&
    !(options.max && date > options.max) &&
    !options.unavailableDates?.includes(date) &&
    !options.isDateUnavailable?.(date)
  );
}
/** Evaluate a consumer's unavailable predicate only when committing a range. */
export function calendarCanCommit(value: readonly string[], options: CalendarOptions): boolean {
  if (options.disabled || options.readOnly) return false;
  if (!value.every((date) => calendarAvailable(date, options))) return false;
  const [start, end] = value;
  if (start && end && options.unavailableDates?.some((date) => date >= start && date <= end))
    return false;
  if (start && end && options.isDateUnavailable) {
    const last = calendarDate(end);
    for (let date = calendarDate(start); date.compare(last) < 0; date = date.add({ days: 1 }))
      if (options.isDateUnavailable(date.toString())) return false;
  }
  return true;
}
export function calendarEvent(date: string, options: CalendarOptions): CalendarEvents {
  const event = options.events?.[date];
  const count = typeof event === 'number' ? event : (event?.count ?? 0);
  return {
    count: Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0,
    label: typeof event === 'object' ? event.label : undefined,
  };
}
export function calendarWords(options: CalendarOptions): CalendarTranslations {
  return { ...calendarTranslations, ...options.translations };
}
export function calendarComplete(
  value: readonly string[],
  selection: LabCalendarSelection,
): boolean {
  return value.length === (selection === 'range' ? 2 : 1);
}
export function calendarWeekday(date: CalendarDate, options: CalendarOptions): number {
  const days: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return getDayOfWeek(
    date,
    options.locale ?? 'en-US',
    options.firstDayOfWeek === undefined ? undefined : days[options.firstDayOfWeek],
  );
}
/** Empty edge cells preserve weekday alignment at the supported ISO year limits. */
export function calendarWeeks(month: string, options: CalendarOptions): (CalendarDate | null)[][] {
  const first = calendarDate(calendarMonth(month));
  const calendar = first.calendar;
  const start = calendar.toJulianDay(first) - calendarWeekday(first, options);
  const lower = calendar.toJulianDay(calendarDate('0001-01-01'));
  const upper = calendar.toJulianDay(calendarDate('9999-12-31'));
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => {
      const julian = start + week * 7 + day;
      return julian < lower || julian > upper ? null : calendar.fromJulianDay(julian);
    }),
  );
}
