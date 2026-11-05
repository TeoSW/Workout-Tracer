import {
  addDays as addDaysToDate,
  differenceInCalendarDays,
  format,
  getISODay,
  isValid,
  parse,
  startOfWeek,
} from 'date-fns';

/** A local calendar date written as yyyy-mm-dd. */
export type DateStr = string;

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const DATE_FORMAT = 'yyyy-MM-dd';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateStr(date: DateStr): Date {
  const parsed = parse(date, DATE_FORMAT, new Date(2000, 0, 1));
  if (!DATE_RE.test(date) || !isValid(parsed)) {
    throw new Error(`Not a valid date: ${date}`);
  }
  return parsed;
}

export function isDateStr(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const parsed = parse(value, DATE_FORMAT, new Date(2000, 0, 1));
  return isValid(parsed) && format(parsed, DATE_FORMAT) === value;
}

export function toDateStr(date: Date): DateStr {
  return format(date, DATE_FORMAT);
}

export function dateOfEpochMs(ms: number): DateStr {
  return toDateStr(new Date(ms));
}

export function addDays(date: DateStr, days: number): DateStr {
  return toDateStr(addDaysToDate(parseDateStr(date), days));
}

/** Calendar days from `from` to `to`, negative when `to` is earlier. */
export function daysBetween(from: DateStr, to: DateStr): number {
  return differenceInCalendarDays(parseDateStr(to), parseDateStr(from));
}

export function mondayOf(date: DateStr): DateStr {
  return toDateStr(startOfWeek(parseDateStr(date), { weekStartsOn: 1 }));
}

export function weekdayOf(date: DateStr): Weekday {
  const weekday = WEEKDAYS[getISODay(parseDateStr(date)) - 1];
  if (!weekday) throw new Error(`No weekday for ${date}`);
  return weekday;
}

const DAY_ZERO = '2000-01-01';

/** A date as a plain day count, for charts that place points on a real time axis. */
export function dayNumber(date: DateStr): number {
  return daysBetween(DAY_ZERO, date);
}

export function dateOfDayNumber(day: number): DateStr {
  return addDays(DAY_ZERO, day);
}
