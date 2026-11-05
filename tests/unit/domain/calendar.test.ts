import { describe, expect, it } from 'vitest';
import {
  dayTypesIn,
  monthGrid,
  monthOf,
  monthRange,
  sessionsByDay,
  stepMonth,
} from '../../../src/domain/calendar';
import { formatDayLabel, formatLongDate, formatMonth } from '../../../src/domain/format';
import { makeSession } from './helpers';

describe('month calendar', () => {
  it('starts each week on Monday and fills whole weeks', () => {
    const weeks = monthGrid('2026-11'); // starts on a Sunday
    expect(weeks).toHaveLength(6);
    expect(weeks[0]?.[0]).toEqual({ date: '2026-10-26', inMonth: false });
    expect(weeks[0]?.[6]).toEqual({ date: '2026-11-01', inMonth: true });
    expect(weeks[5]?.[0]).toEqual({ date: '2026-11-30', inMonth: true });
    expect(weeks[5]?.[6]).toEqual({ date: '2026-12-06', inMonth: false });
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  it('needs no filler when a month starts on Monday', () => {
    const weeks = monthGrid('2026-06');
    expect(weeks[0]?.[0]).toEqual({ date: '2026-06-01', inMonth: true });
    expect(weeks.flat().filter((d) => d.inMonth)).toHaveLength(30);
  });

  it('handles a leap February and a four week February', () => {
    expect(
      monthGrid('2028-02')
        .flat()
        .filter((d) => d.inMonth),
    ).toHaveLength(29);
    expect(monthGrid('2027-02')).toHaveLength(4); // 1 Feb 2027 is a Monday
  });

  it('keeps every day across the DST months in Bucharest', () => {
    for (const month of ['2026-03', '2026-10']) {
      const dates = monthGrid(month)
        .flat()
        .filter((d) => d.inMonth)
        .map((d) => d.date);
      expect(new Set(dates).size).toBe(31);
    }
  });

  it('steps across a year and finds the first and last day', () => {
    expect(stepMonth('2026-12', 1)).toBe('2027-01');
    expect(stepMonth('2026-01', -1)).toBe('2025-12');
    expect(monthOf('2026-11-05')).toBe('2026-11');
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('groups finished sessions by day, earliest first, and leaves out active ones', () => {
    const late = makeSession({ date: '2026-11-03', startedAt: 2000 });
    const early = makeSession({ date: '2026-11-03', startedAt: 1000 });
    const active = makeSession({ date: '2026-11-04', status: 'active', finishedAt: null });
    const days = sessionsByDay([late, early, active]);
    expect(days.get('2026-11-03')?.map((s) => s.id)).toEqual([early.id, late.id]);
    expect(days.has('2026-11-04')).toBe(false);
  });

  it('lists the day types in a stable order for the legend', () => {
    const sessions = [
      makeSession({ date: '2026-11-03', dayType: 'test' }),
      makeSession({ date: '2026-11-04', dayType: 'hypertrophy' }),
      makeSession({ date: '2026-11-05', dayType: 'test' }),
    ];
    expect(dayTypesIn(sessions)).toEqual(['hypertrophy', 'test']);
  });

  it('labels days and months in plain words', () => {
    expect(formatMonth('2026-11')).toBe('November 2026');
    expect(formatLongDate('2026-11-03')).toBe('Tuesday 3 November');
    expect(formatDayLabel('2026-11-03', [])).toBe('Tuesday 3 November');
    expect(
      formatDayLabel('2026-11-03', [
        makeSession({ date: '2026-11-03', name: 'Heavy' }),
        makeSession({ date: '2026-11-03', name: 'Legs' }),
      ]),
    ).toBe('Tuesday 3 November, Heavy, Legs');
  });
});
