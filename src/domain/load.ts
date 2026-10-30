import type { DateStr } from './dates';
import type { Band, BodyweightEntry, Exercise, LoggedSet } from './schemas';

/**
 * Sum of the rated kg of the bands used. Lower is harder and 0 means no band. Band level is a
 * resistance rating, never subtracted from bodyweight.
 */
export function bandLevel(
  bandIds: readonly string[] | undefined,
  bandsById: ReadonlyMap<string, Band>,
): number {
  return (bandIds ?? []).reduce((sum, id) => sum + (bandsById.get(id)?.ratedKg ?? 0), 0);
}

/** The latest bodyweight entry on or before a date. */
export function bodyweightOn(entries: readonly BodyweightEntry[], date: DateStr): number | null {
  let best: BodyweightEntry | null = null;
  for (const entry of entries) {
    if (entry.date <= date && (best === null || entry.date > best.date)) best = entry;
  }
  return best?.kg ?? null;
}

export type EffectiveLoad = { kg: number; includesBodyweight: boolean };

/**
 * Bodyweight plus added kg for weighted bodyweight sets. Without any bodyweight entry, the added
 * kg alone. Banded and plain bodyweight sets have none.
 */
export function effectiveLoad(
  set: LoggedSet,
  exercise: Exercise,
  bodyweight: readonly BodyweightEntry[],
  date: DateStr,
): EffectiveLoad | null {
  if (exercise.trackingType !== 'bodyweight_reps') return null;
  if ((set.bandIds?.length ?? 0) > 0) return null;
  const added = set.addedKg ?? 0;
  if (added <= 0) return null;
  const bw = bodyweightOn(bodyweight, date);
  return bw === null
    ? { kg: added, includesBodyweight: false }
    : { kg: bw + added, includesBodyweight: true };
}
