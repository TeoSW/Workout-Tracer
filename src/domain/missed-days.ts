import { addDays, type DateStr } from './dates';
import { plannedDayTemplateId } from './schedule';
import type { MissedDay, Program, Session } from './schemas';

export type MissedCount = { total: number; marked: number };

/**
 * Missed days in a month (`yyyy-mm`) for a program. A weekday grid counts every past planned day
 * with no finished workout of the program, marked or not, from the program's first workout or
 * missed day. Today only counts once it's marked. Rotations have no fixed days, so they count
 * only the marked ones.
 */
export function missedDaysInMonth(input: {
  program: Program;
  sessions: readonly Session[];
  missedDays: readonly MissedDay[];
  month: string;
  today: DateStr;
}): MissedCount {
  const { program, sessions, month, today } = input;
  const inMonth = (d: DateStr) => d.startsWith(`${month}-`) && d <= today;
  const marked = input.missedDays.filter((m) => m.programId === program.id);
  const markedDates = new Set(marked.map((m) => m.date));
  const markedInMonth = marked.filter((m) => inMonth(m.date)).length;

  if (program.schedule.kind === 'rotation' || program.anchorDate === null) {
    return { total: markedInMonth, marked: markedInMonth };
  }

  const done = new Set(
    sessions
      .filter((s) => s.programId === program.id && s.status === 'finished')
      .map((s) => s.date),
  );
  const from = [...done, ...markedDates].sort()[0];
  if (from === undefined) return { total: markedInMonth, marked: markedInMonth };

  let total = 0;
  let markedCounted = 0;
  for (let d = `${month}-01`; inMonth(d); d = addDays(d, 1)) {
    if (d < from || done.has(d) || plannedDayTemplateId(program, d) === null) continue;
    if (markedDates.has(d)) markedCounted += 1;
    if (d < today || markedDates.has(d)) total += 1;
  }
  // A marked day that is no longer planned, or was done after all, is not counted at all.
  return { total, marked: markedCounted };
}
