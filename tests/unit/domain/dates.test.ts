import { describe, expect, it } from 'vitest';
import {
  addDays,
  dateOfEpochMs,
  daysBetween,
  isDateStr,
  mondayOf,
  parseDateStr,
  toDateStr,
  weekdayOf,
  dateOfDayNumber,
  dayNumber,
} from '../../../src/domain/dates';

describe('dates', () => {
  it('turns dates into day numbers and back, across a DST change', () => {
    expect(dayNumber('2000-01-01')).toBe(0);
    expect(dayNumber('2026-10-26') - dayNumber('2026-10-24')).toBe(2);
    expect(dateOfDayNumber(dayNumber('2026-10-25'))).toBe('2026-10-25');
  });

  it('validates yyyy-mm-dd strings', () => {
    expect(isDateStr('2026-10-30')).toBe(true);
    expect(isDateStr('2026-02-30')).toBe(false);
    expect(isDateStr('2026-1-3')).toBe(false);
    expect(isDateStr('')).toBe(false);
  });

  it('round trips through Date in local time', () => {
    expect(toDateStr(parseDateStr('2026-10-30'))).toBe('2026-10-30');
  });

  it('counts calendar days across DST changes', () => {
    expect(daysBetween('2026-03-28', '2026-03-29')).toBe(1);
    expect(daysBetween('2026-03-29', '2026-03-30')).toBe(1);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(daysBetween('2026-11-02', '2026-10-26')).toBe(-7);
  });

  it('adds days', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('finds the Monday of a week and the weekday', () => {
    expect(mondayOf('2026-11-01')).toBe('2026-10-26');
    expect(mondayOf('2026-10-26')).toBe('2026-10-26');
    expect(weekdayOf('2026-10-26')).toBe('mon');
    expect(weekdayOf('2026-11-01')).toBe('sun');
  });

  it('gives the local day of an epoch timestamp', () => {
    // 2026-10-30 23:30 in Bucharest is 21:30 UTC.
    expect(dateOfEpochMs(Date.UTC(2026, 9, 30, 21, 30))).toBe('2026-10-30');
    expect(dateOfEpochMs(Date.UTC(2026, 9, 30, 22, 30))).toBe('2026-10-31');
  });
});
