import { startOfMonth } from '@internationalized/date';
import * as picker from '@zag-js/date-picker';
import type { MachineModule, SchemaOf } from '../../behaviors/types.js';
import {
  type CalendarOptions,
  calendarDate,
  calendarEvent,
  calendarMonth,
  calendarToday,
  calendarWeekday,
  calendarWords,
} from './contract.js';

export type CalendarSchema = SchemaOf<picker.Service>;
export type CalendarApi = picker.Api;
export type CalendarDay = picker.DateValue;

/** Bind the visible month and range anchor to accepted inputs. Zag otherwise
 * advances its private start/index before a controlled parent accepts a request. */
export const calendarBehavior: MachineModule<CalendarSchema, CalendarApi> = {
  machine: {
    ...picker.machine,
    props(params) {
      if (!picker.machine.props) throw new Error('Date picker props are required');
      return {
        ...picker.machine.props(params),
        value: params.props.value,
        focusedValue: params.props.focusedValue,
      };
    },
    implementations: {
      ...picker.machine.implementations,
      actions: {
        ...picker.machine.implementations?.actions,
        // Calendar renders focus after accepted keyboard state. A delayed Zag
        // callback must never steal focus from a sibling control or calendar.
        focusActiveCell() {},
        focusActiveCellIfNeeded() {},
      },
    },
    context(params) {
      const { prop, bindable } = params;
      if (!picker.machine.context) throw new Error('Date picker context is required');
      return {
        ...picker.machine.context(params),
        startValue: bindable(() => ({
          value: startOfMonth(
            prop('focusedValue') ?? prop('defaultFocusedValue') ?? calendarDate(calendarToday()),
          ),
          isEqual: (a, b) => !!b && a.compare(b) === 0,
          hash: (date) => date.toString(),
        })),
        activeIndex: bindable(() => ({
          value: prop('selectionMode') === 'range' && prop('value')?.length === 1 ? 1 : 0,
        })),
      };
    },
  },
  connect: picker.connect,
};

export function calendarProps(
  id: string,
  value: readonly string[],
  focus: string,
  options: CalendarOptions,
  onValueChange: (value: string[]) => void,
  onFocusChange: (date: string) => void,
  dir: 'ltr' | 'rtl' = 'ltr',
): picker.Props {
  if (
    options.min &&
    options.max &&
    calendarDate(options.min).compare(calendarDate(options.max)) > 0
  )
    throw new RangeError('Minimum date must not exceed maximum date');
  if (
    options.firstDayOfWeek !== undefined &&
    (!Number.isInteger(options.firstDayOfWeek) ||
      options.firstDayOfWeek < 0 ||
      options.firstDayOfWeek > 6)
  )
    throw new RangeError('First day of week must be 0–6');
  const unavailable = new Set(
    options.unavailableDates?.map((date) => calendarDate(date).toString()),
  );
  return {
    id,
    dir,
    inline: true,
    fixedWeeks: true,
    closeOnSelect: false,
    view: 'day',
    outsideDaySelectable: false,
    locale: options.locale ?? 'en-US',
    timeZone: 'UTC',
    selectionMode: options.selection ?? 'single',
    value: value.map(calendarDate),
    focusedValue: calendarDate(focus),
    disabled: options.disabled,
    readOnly: options.readOnly,
    startOfWeek: options.firstDayOfWeek,
    min: options.min ? calendarDate(options.min) : calendarDate('0001-01-01'),
    max: options.max ? calendarDate(options.max) : calendarDate('9999-12-31'),
    isDateUnavailable: (date) =>
      unavailable.has(date.toString()) || (options.isDateUnavailable?.(date.toString()) ?? false),
    onValueChange: ({ value: dates }) => onValueChange(dates.map((date) => date.toString())),
    onFocusChange: ({ focusedValue }) => onFocusChange(focusedValue.toString()),
  };
}

export function calendarCell(api: CalendarApi, date: CalendarDay, options: CalendarOptions) {
  const iso = date.toString();
  const state = api.getDayTableCellState({ value: date, disabled: options.disabled });
  const selected = api.value.some((item) => item.compare(date) === 0);
  const [start, end] = api.value;
  const range =
    options.selection === 'range' &&
    start &&
    end &&
    date.compare(start) >= 0 &&
    date.compare(end) <= 0;
  const edge = range
    ? date.compare(start) === 0 && date.compare(end) === 0
      ? 'single'
      : date.compare(start) === 0
        ? 'start'
        : date.compare(end) === 0
          ? 'end'
          : 'middle'
    : undefined;
  const event = calendarEvent(iso, options);
  const marked = options.markers?.includes(iso) ?? false;
  const words = calendarWords(options);
  const label = [
    api.format(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    event.count
      ? (event.label ??
        (typeof words.events === 'function'
          ? words.events(event.count)
          : words.events.replaceAll(
              '{count}',
              new Intl.NumberFormat(options.locale).format(event.count),
            )))
      : '',
    marked ? words.marker : '',
  ]
    .filter(Boolean)
    .join(', ');
  return {
    iso,
    state,
    selected: !state.outsideRange && (selected || range),
    edge: state.outsideRange ? undefined : edge,
    count: Math.min(5, event.count),
    marked,
    label,
    current: options.today === iso ? ('date' as const) : undefined,
  };
}

export function calendarTitle(api: CalendarApi): string {
  return api.format(calendarDate(calendarMonth(api.focusedValue.toString())), {
    month: 'long',
    year: 'numeric',
  });
}

export function calendarTableProps(api: CalendarApi, options: CalendarOptions) {
  const { onKeyDown, onkeydown, ...props } = api.getTableProps();
  const keydown = onKeyDown ?? onkeydown;
  return {
    ...props,
    onKeyDown(event: KeyboardEvent) {
      if (options.disabled) return;
      if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey) return;
      const table = event.currentTarget as HTMLElement;
      const active = (table.getRootNode() as Document | ShadowRoot).activeElement;
      if (event.key === ' ' && !options.readOnly) {
        event.preventDefault();
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
          '.lab-calendar-day',
        );
        button?.click();
      } else if (options.readOnly && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        return;
      } else if (event.key === 'Home' || event.key === 'End') {
        const date = calendarDate(api.focusedValue.toString());
        const offset = calendarWeekday(date, options);
        api.setFocusedValue(date.add({ days: event.key === 'Home' ? -offset : 6 - offset }));
        event.preventDefault();
      } else keydown?.(event);
      if (!event.defaultPrevented) return;
      table.ownerDocument.defaultView?.requestAnimationFrame(() => {
        if (!table.isConnected) return;
        const tree = table.getRootNode() as Document | ShadowRoot;
        const current = tree.activeElement;
        const outer = table.ownerDocument.activeElement;
        if (!current && active?.isConnected) return;
        if (!current && 'host' in tree && outer !== tree.host && outer !== table.ownerDocument.body)
          return;
        // A later Tab/click/focus belongs to the user. Only follow a retained or
        // removed calendar cell; focus() also reveals the cell in a narrow grid.
        if (
          current &&
          current !== active &&
          current !== table.ownerDocument.body &&
          !table.contains(current)
        )
          return;
        table.querySelector<HTMLElement>('.lab-calendar-day[tabindex="0"]')?.focus();
      });
    },
  };
}

/** Cancel a pending keyboard focus handoff when the user acts on another control. */
export function listenCalendarFocus(root: HTMLElement, cancel: () => void): () => void {
  const listener = (event: Event) => {
    const path = event.composedPath();
    if (
      !path.includes(root) ||
      !path.some(
        (node) => node instanceof HTMLElement && node.classList.contains('lab-calendar-day'),
      )
    )
      cancel();
  };
  root.ownerDocument.addEventListener('focusin', listener);
  root.ownerDocument.addEventListener('pointerdown', listener);
  return () => {
    root.ownerDocument.removeEventListener('focusin', listener);
    root.ownerDocument.removeEventListener('pointerdown', listener);
  };
}
