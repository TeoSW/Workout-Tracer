import { mondayOf, type DateStr } from './dates';
import { cyclePosition } from './schedule';
import type { Program } from './schemas';

/** A planned deload week (a cycle week in `deloadWeeks`) or one deloaded by hand. */
export function isDeloadWeek(program: Program, date: DateStr): boolean {
  if (program.manualDeloadWeeks.includes(mondayOf(date))) return true;
  const position = cyclePosition(program, date);
  return position !== null && program.deloadWeeks.includes(position.cycleWeek);
}
