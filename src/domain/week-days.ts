import { WEEKDAYS, type Weekday } from './dates';
import type { DayTemplate, Program } from './schemas';

export type WeekDay = { dayTemplateId: string; weekday: Weekday | null };

/**
 * The days to offer when starting a workout as a given week: that week's grid days in weekday
 * order for weekday programs, the rotation order for rotations. Days the week doesn't use come
 * after, so any day of the program can still be picked.
 */
export function daysForWeek(
  program: Program,
  days: readonly DayTemplate[],
  cycleWeek: number,
): { planned: WeekDay[]; others: WeekDay[] } {
  const planned: WeekDay[] = [];
  if (program.schedule.kind === 'weekday') {
    const grid = program.schedule.weeks[cycleWeek - 1];
    if (grid) {
      for (const weekday of WEEKDAYS) {
        const id = grid[weekday];
        if (id !== null) planned.push({ dayTemplateId: id, weekday });
      }
    }
  } else {
    const seen = new Set<string>();
    for (const id of program.schedule.sequence) {
      if (!seen.has(id)) planned.push({ dayTemplateId: id, weekday: null });
      seen.add(id);
    }
  }
  const used = new Set(planned.map((d) => d.dayTemplateId));
  const others = days
    .filter((d) => !used.has(d.id))
    .map((d) => ({ dayTemplateId: d.id, weekday: null }));
  return { planned, others };
}
