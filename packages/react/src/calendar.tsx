'use client';

import { symbol as checkmark } from '@labpics/icons/symbols/checkmark';
import {
  calendarBehavior,
  calendarCell,
  calendarProps,
  calendarTableProps,
  calendarTitle,
  listenCalendarFocus,
} from '@labpics/ui-core/calendar/behavior';
import {
  type CalendarOptions,
  type LabCalendarSelection,
  type LabCalendarSize,
  calendarCanCommit,
  calendarComplete,
  calendarFocus,
  calendarMonth,
  calendarToday,
  calendarValue,
  calendarWeeks,
  calendarWords,
} from '@labpics/ui-core/calendar/contract';
import { mountMaterialRuntime } from '@labpics/ui-materials';
import {
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { Icon } from './icon.js';
import { useZag } from './use-zag.js';
import '@labpics/ui-core/calendar.css';
import '@labpics/ui-materials/material.css';

export type {
  CalendarEvents,
  CalendarTranslations,
  LabCalendarSelection,
  LabCalendarSize,
} from '@labpics/ui-core/calendar/contract';
export interface CalendarProps
  extends CalendarOptions,
    Omit<HTMLAttributes<HTMLElement>, 'onChange' | 'defaultValue'> {
  size?: LabCalendarSize;
  selection?: LabCalendarSelection;
  value?: readonly string[];
  defaultValue?: readonly string[];
  month?: string;
  defaultMonth?: string;
  name?: string;
  required?: boolean;
  label?: string;
  onValueChange?: (value: string[]) => void;
  onMonthChange?: (month: string) => void;
}

/** Authored mini calendar: six weeks, date-only values, shared Zag behavior. */
export function Calendar({
  size = 's',
  selection = 'single',
  value,
  defaultValue = [],
  month,
  defaultMonth,
  locale = 'en-US',
  firstDayOfWeek,
  today,
  min,
  max,
  disabled = false,
  readOnly = false,
  isDateUnavailable,
  unavailableDates,
  events,
  markers,
  translations,
  name,
  required = false,
  label = 'Calendar',
  onValueChange,
  onMonthChange,
  dir,
  ...rest
}: CalendarProps) {
  const id = useId();
  const root = useRef<HTMLFieldSetElement>(null);
  const [todayValue] = useState(() => today ?? calendarToday());
  const [initial] = useState(() => ({
    value: calendarValue(defaultValue, selection),
    month: calendarMonth(
      defaultMonth ?? month ?? value?.[0] ?? defaultValue[0] ?? today ?? todayValue,
    ),
  }));
  const [ownValue, setOwnValue] = useState(initial.value);
  const [ownMonth, setOwnMonth] = useState(initial.month);
  const [focus, setFocus] = useState(value?.[0] ?? defaultValue[0] ?? today ?? todayValue);
  const [pendingFocus, setPendingFocus] = useState<string>();
  const pendingKeyboardFocus = useRef(false);
  const [direction, setDirection] = useState<'ltr' | 'rtl'>(dir === 'rtl' ? 'rtl' : 'ltr');
  const selected = calendarValue(value ?? ownValue, selection);
  const options: CalendarOptions = {
    selection,
    locale,
    firstDayOfWeek,
    today: today ?? todayValue,
    min,
    max,
    disabled,
    readOnly,
    isDateUnavailable,
    unavailableDates,
    events,
    markers,
    translations,
  };
  const shownMonth = calendarMonth(month ?? ownMonth);
  const acceptedPending =
    pendingFocus && calendarMonth(pendingFocus) === shownMonth ? pendingFocus : undefined;
  const api = useZag(
    calendarBehavior,
    calendarProps(
      id,
      selected,
      calendarFocus(acceptedPending ?? focus, shownMonth, options),
      options,
      (dates) => {
        const next = calendarValue(dates, selection);
        if (!calendarCanCommit(next, options)) return;
        if (value === undefined) setOwnValue(next);
        onValueChange?.(next);
      },
      (date) => {
        const nextMonth = calendarMonth(date);
        if (nextMonth === shownMonth) {
          setFocus(date);
          setPendingFocus(undefined);
          return;
        }
        if (month === undefined) {
          setOwnMonth(nextMonth);
          setFocus(date);
          setPendingFocus(undefined);
        } else {
          setPendingFocus(date);
          pendingKeyboardFocus.current = !!root.current?.querySelector('.lab-calendar-day:focus');
        }
        onMonthChange?.(nextMonth);
      },
      direction,
    ),
  );
  const words = calendarWords(options);
  useEffect(() => (root.current ? mountMaterialRuntime(root.current) : undefined), []);
  useEffect(
    () =>
      root.current
        ? listenCalendarFocus(root.current, () => {
            pendingKeyboardFocus.current = false;
          })
        : undefined,
    [],
  );
  useEffect(() => {
    if (!pendingFocus || calendarMonth(pendingFocus) !== shownMonth) return;
    setFocus(pendingFocus);
    setPendingFocus(undefined);
    if (pendingKeyboardFocus.current)
      root.current?.querySelector<HTMLElement>('.lab-calendar-day[tabindex="0"]')?.focus();
    pendingKeyboardFocus.current = false;
  }, [pendingFocus, shownMonth]);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const update = () =>
      setDirection(getComputedStyle(element).direction === 'rtl' ? 'rtl' : 'ltr');
    update();
    const observer = new MutationObserver(update);
    for (let node: HTMLElement | null = element; node; node = node.parentElement)
      observer.observe(node, { attributes: true, attributeFilter: ['dir', 'class', 'style'] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const form = root.current?.closest('form');
    const reset = (event: Event) =>
      queueMicrotask(() => {
        if (event.defaultPrevented) return;
        if (value === undefined) setOwnValue([...initial.value]);
        if (month === undefined) setOwnMonth(initial.month);
        setFocus(initial.value[0] ?? initial.month);
        setPendingFocus(undefined);
        pendingKeyboardFocus.current = false;
      });
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, [value, month, initial]);
  const table = calendarTableProps(api, options);
  return (
    <fieldset
      {...rest}
      ref={root}
      dir={dir}
      data-lab-calendar=""
      data-size={size}
      data-disabled={disabled ? '' : undefined}
      data-readonly={readOnly ? '' : undefined}
      aria-label={label}
    >
      <span className="lab-calendar-surface lab-material lab-material--base" aria-hidden="true" />
      <div className="lab-calendar-header">
        <button
          {...api.getPrevTriggerProps()}
          className="lab-calendar-nav lab-calendar-prev"
          aria-label={words.previousMonth}
        >
          <span className="lab-calendar-chevron" aria-hidden="true" />
        </button>
        <span className="lab-calendar-title" aria-live="polite" aria-atomic="true">
          {calendarTitle(api)}
        </span>
        <button
          {...api.getNextTriggerProps()}
          className="lab-calendar-nav lab-calendar-next"
          aria-label={words.nextMonth}
        >
          <span className="lab-calendar-chevron" aria-hidden="true" />
        </button>
      </div>
      <div className="lab-calendar-area" id={api.getContentProps().id}>
        <table
          {...table}
          onKeyDown={(event: ReactKeyboardEvent) =>
            table.onKeyDown(event as unknown as KeyboardEvent)
          }
          className="lab-calendar-grid"
          aria-label={`${label}, ${calendarTitle(api)}`}
        >
          <thead>
            <tr>
              {api.weekDays.map((day) => (
                <th
                  key={day.long}
                  className="lab-calendar-weekday"
                  scope="col"
                  aria-label={day.long}
                >
                  {day.narrow}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calendarWeeks(api.focusedValue.toString(), options).map((week, weekIndex) => (
              <tr key={week[0]?.toString() ?? weekIndex}>
                {week.map((date, index) => {
                  if (!date)
                    return (
                      <td
                        key={`empty-${api.weekDays[index]?.long}`}
                        className="lab-calendar-cell"
                        aria-disabled="true"
                      />
                    );
                  const cell = calendarCell(api, date, options);
                  const unavailable = disabled || readOnly || !cell.state.selectable;
                  return (
                    <td
                      key={cell.iso}
                      className="lab-calendar-cell"
                      aria-selected={cell.selected}
                      aria-disabled={unavailable || undefined}
                      aria-current={cell.current}
                    >
                      <button
                        {...api.getDayTableCellTriggerProps({
                          value: date,
                          disabled: disabled || readOnly,
                        })}
                        type="button"
                        className="lab-calendar-day"
                        onPointerMove={undefined}
                        data-date={cell.iso}
                        data-today={cell.current ? '' : undefined}
                        aria-label={cell.label}
                        tabIndex={disabled ? -1 : cell.state.focused ? 0 : -1}
                        data-active={cell.selected ? '' : undefined}
                        data-range={cell.edge}
                      >
                        {api.format(date, { day: 'numeric' })}
                        {cell.count > 0 && (
                          <span className="lab-calendar-dots" aria-hidden="true">
                            {Array.from({ length: cell.count }, (_, index) => (
                              // biome-ignore lint/suspicious/noArrayIndexKey: Decorative dots never reorder and have no state.
                              <i key={`dot-${index}`} className="lab-calendar-dot" />
                            ))}
                          </span>
                        )}
                        {cell.marked && (
                          <span className="lab-calendar-marker" aria-hidden="true">
                            <Icon symbol={checkmark} size={12} />
                          </span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected.map((date, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: The two submission slots are range start/end, including equal dates.
        <input key={`value-${index}`} type="hidden" name={name} value={date} disabled={disabled} />
      ))}
      <input
        className="lab-calendar-validation"
        tabIndex={-1}
        aria-hidden="true"
        value={calendarComplete(selected, selection) ? 'complete' : ''}
        readOnly={!required || readOnly}
        required={required}
        disabled={disabled || readOnly}
        onChange={() => {}}
        onInvalid={(event) => {
          event.preventDefault();
          root.current?.querySelector<HTMLElement>('.lab-calendar-day[tabindex="0"]')?.focus();
        }}
      />
    </fieldset>
  );
}
