import { addMonths, endOfMonth, format } from 'date-fns';
import { addDays, mondayOf, parseDateStr, toDateStr, type DateStr } from './dates';
import { DAY_TYPES, type DayType, type Session } from './schemas';

/** A calendar month written as yyyy-mm. */
export type MonthStr = string;

export type CalendarDay = { date: DateStr; inMonth: boolean };

export const monthOf = (date: DateStr): MonthStr => date.slice(0, 7);

export function stepMonth(month: MonthStr, months: number): MonthStr {
  return format(addMonths(parseDateStr(`${month}-01`), months), 'yyyy-MM');
}

export function monthRange(month: MonthStr): { from: DateStr; to: DateStr } {
  const from = `${month}-01`;
  return { from, to: toDateStr(endOfMonth(parseDateStr(from))) };
}

/** Whole Monday to Sunday weeks covering a month, with days of the months around it marked. */
export function monthGrid(month: MonthStr): CalendarDay[][] {
  const { to } = monthRange(month);
  const weeks: CalendarDay[][] = [];
  for (let start = mondayOf(`${month}-01`); start <= to; start = addDays(start, 7)) {
    weeks.push(
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(start, i);
        return { date, inMonth: monthOf(date) === month };
      }),
    );
  }
  return weeks;
}

/** Finished sessions by day, earliest first. */
export function sessionsByDay(sessions: readonly Session[]): Map<DateStr, Session[]> {
  const days = new Map<DateStr, Session[]>();
  const finished = sessions
    .filter((s) => s.status === 'finished')
    .sort((a, b) => a.startedAt - b.startedAt);
  for (const session of finished) {
    const list = days.get(session.date);
    if (list) list.push(session);
    else days.set(session.date, [session]);
  }
  return days;
}

export function dayTypesIn(sessions: readonly Session[]): DayType[] {
  const present = new Set(sessions.map((s) => s.dayType));
  return DAY_TYPES.filter((type) => present.has(type));
}
