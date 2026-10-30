import { addDays, type DateStr } from './dates';
import type { BodyweightEntry } from './schemas';
import { round2 } from './sets';

export type BodyweightPoint = { date: DateStr; kg: number; average: number };

/** Each entry with the average of all entries in the 7 calendar days ending on it. */
export function movingAverage7(entries: readonly BodyweightEntry[]): BodyweightPoint[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  // Sliding window: `start` moves forward as entries fall out of the 7 days.
  let start = 0;
  let sum = 0;
  return sorted.map((entry, i) => {
    sum += entry.kg;
    const from = addDays(entry.date, -6);
    for (
      let first = sorted[start];
      first !== undefined && first.date < from;
      first = sorted[start]
    ) {
      sum -= first.kg;
      start += 1;
    }
    return { date: entry.date, kg: entry.kg, average: round2(sum / (i - start + 1)) };
  });
}
