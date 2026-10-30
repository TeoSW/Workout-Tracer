import { addDays, daysBetween, mondayOf, weekdayOf, type DateStr } from './dates';
import type { Program, Session } from './schemas';

export type CyclePosition = { weeksSinceAnchor: number; cycleNumber: number; cycleWeek: number };

const mod = (n: number, m: number) => ((n % m) + m) % m;

/**
 * Where a date falls in the program's cycle. Null when the program has no anchor yet or no cycle
 * length (a rotation without deloads). Dates before the anchor give cycle 0 or less.
 */
export function cyclePosition(program: Program, date: DateStr): CyclePosition | null {
  if (program.anchorDate === null || program.cycleWeeks === null) return null;
  const weeksSinceAnchor = Math.floor(daysBetween(program.anchorDate, date) / 7);
  return {
    weeksSinceAnchor,
    cycleNumber: Math.floor(weeksSinceAnchor / program.cycleWeeks) + 1,
    cycleWeek: mod(weeksSinceAnchor, program.cycleWeeks) + 1,
  };
}

/** The day template planned on a date in a weekday grid, or null for rest. */
export function plannedDayTemplateId(program: Program, date: DateStr): string | null {
  if (program.schedule.kind !== 'weekday') {
    throw new Error('plannedDayTemplateId only works on weekday grids');
  }
  const position = cyclePosition(program, date);
  if (position === null) throw new Error('The program has no anchor date yet');
  const week = program.schedule.weeks[position.cycleWeek - 1];
  if (!week) throw new Error(`No week ${position.cycleWeek} in the grid`);
  return week[weekdayOf(date)];
}

/** The anchor date that puts `today` in week `n` of the cycle. */
export function setCurrentWeek(program: Program, today: DateStr, n: number): DateStr {
  const cycleWeeks = program.cycleWeeks ?? 1;
  if (!Number.isInteger(n) || n < 1 || n > cycleWeeks) {
    throw new Error(`Week must be between 1 and ${cycleWeeks}`);
  }
  return addDays(mondayOf(today), -7 * (n - 1));
}

/** The latest finished session of a program, by finish time. */
export function latestFinishedSession(sessions: Session[], programId: string): Session | null {
  let latest: Session | null = null;
  for (const s of sessions) {
    if (s.programId !== programId || s.status !== 'finished' || s.finishedAt === null) continue;
    if (latest === null || s.finishedAt > (latest.finishedAt ?? 0)) latest = s;
  }
  return latest;
}

function rotationSequence(program: Program): string[] {
  if (program.schedule.kind !== 'rotation') throw new Error('Not a rotation program');
  return program.schedule.sequence;
}

/** Index of the next rotation day, given the rotation index of the latest finished session. */
export function nextRotationIndex(program: Program, lastRotationIndex: number | null): number {
  const sequence = rotationSequence(program);
  return lastRotationIndex === null ? 0 : mod(lastRotationIndex + 1, sequence.length);
}

/**
 * The rotation index to store when the user starts a day that may not be the suggested one:
 * the first position of that day at or after the pointer, wrapping around.
 */
export function rotationIndexForPick(
  program: Program,
  pointer: number,
  dayTemplateId: string,
): number {
  const sequence = rotationSequence(program);
  for (let step = 0; step < sequence.length; step++) {
    const index = mod(pointer + step, sequence.length);
    if (sequence[index] === dayTemplateId) return index;
  }
  throw new Error(`Day ${dayTemplateId} is not in the rotation`);
}
