import { addDays, type DateStr } from './dates';
import type { BodyweightEntry } from './schemas';
import { round2 } from './sets';

export type BodyweightPoint = { date: DateStr; kg: number; average: number };

/** Each entry with the average of all entries in the 7 calendar days ending on it. */
export function movingAverage7(entries: readonly BodyweightEntry[]): BodyweightPoint[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((entry) => {
    const from = addDays(entry.date, -6);
    const window = sorted.filter((e) => e.date >= from && e.date <= entry.date);
    const average = window.reduce((sum, e) => sum + e.kg, 0) / window.length;
    return { date: entry.date, kg: entry.kg, average: round2(average) };
  });
}
