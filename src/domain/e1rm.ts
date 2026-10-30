import type { DateStr } from './dates';
import { effectiveLoad } from './load';
import type { BodyweightEntry, Exercise, LoggedSet, Session } from './schemas';
import { countsForStats, finishedSessionsById, round2 } from './sets';

/**
 * Epley with RIR: load x (1 + (reps + rir) / 30), only when reps + rir <= 15. A trend line, not
 * a max prediction.
 */
export function epley(load: number, reps: number, rir: number | null): number | null {
  const effortReps = reps + (rir ?? 0);
  if (reps < 1 || effortReps > 15) return null;
  return round2(load * (1 + effortReps / 30));
}

/** The load used for e1RM: logged kg, or the effective load of a weighted bodyweight set. */
export function e1rmLoad(
  set: LoggedSet,
  exercise: Exercise,
  bodyweight: readonly BodyweightEntry[],
  date: DateStr,
): number | null {
  if (exercise.trackingType === 'weight_reps') return set.kg ?? null;
  return effectiveLoad(set, exercise, bodyweight, date)?.kg ?? null;
}

export function setE1rm(
  set: LoggedSet,
  exercise: Exercise,
  bodyweight: readonly BodyweightEntry[],
  date: DateStr,
): number | null {
  const load = e1rmLoad(set, exercise, bodyweight, date);
  if (load === null || load <= 0 || set.reps === undefined) return null;
  return epley(load, set.reps, set.rir);
}

export type E1rmPoint = { sessionId: string; date: DateStr; setId: string; e1rm: number };

/** The best e1RM set of each finished session, oldest first. */
export function bestE1rmPerSession(input: {
  sessions: readonly Session[];
  sets: readonly LoggedSet[];
  exercise: Exercise;
  bodyweight: readonly BodyweightEntry[];
}): E1rmPoint[] {
  const sessions = finishedSessionsById(input.sessions);
  const best = new Map<string, E1rmPoint>();
  for (const set of input.sets) {
    const session = sessions.get(set.sessionId);
    if (!session || set.exerciseId !== input.exercise.id || !countsForStats(set)) continue;
    const e1rm = setE1rm(set, input.exercise, input.bodyweight, session.date);
    if (e1rm === null) continue;
    const current = best.get(session.id);
    if (!current || e1rm > current.e1rm) {
      best.set(session.id, { sessionId: session.id, date: session.date, setId: set.id, e1rm });
    }
  }
  return [...best.values()].sort((a, b) => a.date.localeCompare(b.date));
}
