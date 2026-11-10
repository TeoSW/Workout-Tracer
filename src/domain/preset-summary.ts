import { WEEKDAYS, type Weekday } from './dates';
import type { BuiltInTemplate } from './fixtures/templates/types';
import type { WeekGrid } from './schemas';

/** "5-week cycle, 4 days a week, deload in week 5", or "Rotation, 3 days a week". */
export function presetSummary(t: BuiltInTemplate): string {
  if (t.schedule.kind === 'rotation') {
    return `Rotation, ${t.schedule.sessionsPerWeek} days a week`;
  }
  const first = t.schedule.weeks[0];
  const perWeek = first ? Object.values(first).filter((id) => id !== null).length : 0;
  const parts = [
    t.cycleWeeks !== null && t.cycleWeeks > 1 ? `${t.cycleWeeks}-week cycle` : 'Weekly',
    `${perWeek} days a week`,
  ];
  if (t.deloadWeeks.length > 0) parts.push(`deload in week ${t.deloadWeeks.join(' and ')}`);
  return parts.join(', ');
}

export type PresetWeek = {
  /** "Week 1", or "Weeks 1-2" when weeks in a row are the same. */
  label: string;
  days: { weekday: Weekday; dayName: string }[];
};

const sameWeek = (a: WeekGrid, b: WeekGrid) => WEEKDAYS.every((d) => a[d] === b[d]);

/** The weekday grid with repeated weeks folded together. Empty for rotations. */
export function presetWeeks(t: BuiltInTemplate): PresetWeek[] {
  if (t.schedule.kind !== 'weekday') return [];
  const names = new Map(t.dayTemplates.map((d) => [d.id, d.name]));
  const weeks = t.schedule.weeks;
  const out: PresetWeek[] = [];
  let start = 0;
  for (let i = 1; i <= weeks.length; i++) {
    const current = weeks[i];
    const first = weeks[start];
    if (first === undefined) break;
    if (current !== undefined && sameWeek(current, first)) continue;
    const label =
      weeks.length === 1
        ? 'Every week'
        : i - start === 1
          ? `Week ${start + 1}`
          : `Weeks ${start + 1}-${i}`;
    out.push({
      label,
      days: WEEKDAYS.flatMap((weekday) => {
        const id = first[weekday];
        return id === null ? [] : [{ weekday, dayName: names.get(id) ?? 'Workout' }];
      }),
    });
    start = i;
  }
  return out;
}
