import { describe, expect, it } from 'vitest';
import {
  calendarCanCommit,
  calendarDate,
  calendarEvent,
  calendarFocus,
  calendarMonth,
  calendarValue,
  calendarWeeks,
} from '../src/components/calendar/contract.js';

describe('calendar date-only contract', () => {
  it('rejects timestamps and impossible dates; retains leap dates and year rollover', () => {
    for (const input of [
      '2024-02-30',
      '1900-02-29',
      '2024-01-01T00:00:00Z',
      '2024-1-1',
      '0000-01-01',
    ])
      expect(() => calendarDate(input)).toThrow();
    expect(calendarDate('2000-02-29').add({ years: 1 }).toString()).toBe('2001-02-28');
    expect(calendarDate('2024-12-31').add({ days: 1 }).toString()).toBe('2025-01-01');
    expect(calendarDate('2024-03-10').add({ days: 1 }).toString()).toBe('2024-03-11');
    expect(calendarDate('2024-11-03').add({ days: 1 }).toString()).toBe('2024-11-04');
  });
  it('normalizes ranges and month without changing date identity', () => {
    expect(calendarValue(['2025-01-02', '2024-12-30'], 'range')).toEqual([
      '2024-12-30',
      '2025-01-02',
    ]);
    expect(calendarMonth('2024-02-29')).toBe('2024-02-01');
    expect(calendarFocus('2024-01-31', '2024-02-01', {})).toBe('2024-02-29');
    expect(() => calendarValue(['2024-01-01', '2024-01-02'], 'single')).toThrow();
  });
  it('cannot complete a range across unavailable days or outside bounds', () => {
    const options = {
      min: '2024-05-10',
      max: '2024-06-20',
      isDateUnavailable: (date: string) => date === '2024-06-01',
    };
    expect(calendarCanCommit(['2024-05-31'], options)).toBe(true);
    expect(calendarCanCommit(['2024-05-31', '2024-06-02'], options)).toBe(false);
    expect(calendarCanCommit(['2024-05-09'], options)).toBe(false);
    expect(calendarCanCommit(['2024-06-02', '2024-06-20'], options)).toBe(true);
    expect(calendarCanCommit(['2024-06-02'], { readOnly: true })).toBe(false);
  });
  it('preserves full event counts for accessible text', () => {
    expect(calendarEvent('2024-01-01', { events: { '2024-01-01': 17 } })).toEqual({
      count: 17,
      label: undefined,
    });
  });
  it('preserves weekday positions and unique cells at ISO year boundaries', () => {
    for (const month of ['0001-01-01', '9999-12-01']) {
      const cells = calendarWeeks(month, { firstDayOfWeek: 0 }).flat();
      expect(cells).toHaveLength(42);
      const dates = cells.filter((date) => date !== null).map((date) => date.toString());
      expect(new Set(dates).size).toBe(dates.length);
      expect(dates.every((date) => date >= '0001-01-01' && date <= '9999-12-31')).toBe(true);
    }
    expect(calendarWeeks('0001-01-01', { firstDayOfWeek: 0 })[0]?.[0]).toBeNull();
  });
});
