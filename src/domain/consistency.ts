import { addDays, mondayOf, type DateStr } from './dates';
import { cyclePosition } from './schedule';
import type { Program, Session } from './schemas';

/**
 * Non-rest grid entries for weekday programs, `sessionsPerWeek` for rotations. Null for a weekday
 * program that has no anchor yet, since its weeks are not placed on the calendar.
 */
export function plannedSessionsInWeek(program: Program, weekStart: DateStr): number | null {
  if (program.schedule.kind === 'rotation') return program.schedule.sessionsPerWeek;
  const position = cyclePosition(program, weekStart);
  if (position === null) return null;
  const week = program.schedule.weeks[position.cycleWeek - 1];
  return week ? Object.values(week).filter((id) => id !== null).length : 0;
}

export function finishedSessionsInWeek(
  sessions: readonly Session[],
  weekStart: DateStr,
  programId?: string,
): number {
  const weekEnd = addDays(weekStart, 6);
  return sessions.filter(
    (s) =>
      s.status === 'finished' &&
      s.date >= weekStart &&
      s.date <= weekEnd &&
      (programId === undefined || s.programId === programId),
  ).length;
}

/**
 * Consecutive Monday to Sunday weeks with at least one finished session. Counts back from this
 * week, or from last week when this week has none yet, so an unfinished week doesn't break it.
 */
export function weekStreak(finishedDates: readonly DateStr[], today: DateStr): number {
  const weeks = new Set(finishedDates.map(mondayOf));
  let week = mondayOf(today);
  if (!weeks.has(week)) week = addDays(week, -7);
  let streak = 0;
  while (weeks.has(week)) {
    streak += 1;
    week = addDays(week, -7);
  }
  return streak;
}

export function sessionDurationMs(session: Session): number | null {
  return session.finishedAt === null ? null : session.finishedAt - session.startedAt;
}
