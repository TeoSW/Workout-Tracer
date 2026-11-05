import { addDays, type DateStr } from './dates';
import { MUSCLES, type Exercise, type LoggedSet, type Muscle, type Session } from './schemas';
import { countsForStats, finishedSessionsById } from './sets';

export type MuscleVolume = Record<Muscle, number>;

const emptyVolume = (): MuscleVolume =>
  Object.fromEntries(MUSCLES.map((m) => [m, 0])) as MuscleVolume;

/**
 * Sets per muscle for the Monday to Sunday week starting on `weekStart`. Each done working set
 * adds 1 to each primary muscle and 0.5 to each secondary. Attempts and checklists count 0.
 */
export function weeklySetsPerMuscle(input: {
  sessions: readonly Session[];
  sets: readonly LoggedSet[];
  exercisesById: ReadonlyMap<string, Exercise>;
  weekStart: DateStr;
}): MuscleVolume {
  const weekEnd = addDays(input.weekStart, 6);
  const sessions = finishedSessionsById(input.sessions);
  const volume = emptyVolume();
  for (const set of input.sets) {
    const session = sessions.get(set.sessionId);
    if (!session || session.date < input.weekStart || session.date > weekEnd) continue;
    if (!countsForStats(set)) continue;
    const exercise = input.exercisesById.get(set.exerciseId);
    if (
      !exercise ||
      exercise.trackingType === 'attempts' ||
      exercise.trackingType === 'checklist'
    ) {
      continue;
    }
    for (const m of exercise.primaryMuscles) volume[m] += 1;
    for (const m of exercise.secondaryMuscles) volume[m] += 0.5;
  }
  return volume;
}

/** Average of the `weeks` weeks ending with the week that starts on `lastWeekStart`. */
export function averageWeeklySetsPerMuscle(input: {
  sessions: readonly Session[];
  sets: readonly LoggedSet[];
  exercisesById: ReadonlyMap<string, Exercise>;
  lastWeekStart: DateStr;
  weeks?: number;
}): MuscleVolume {
  const weeks = input.weeks ?? 4;
  const total = emptyVolume();
  for (let i = 0; i < weeks; i++) {
    const week = weeklySetsPerMuscle({ ...input, weekStart: addDays(input.lastWeekStart, -7 * i) });
    for (const m of MUSCLES) total[m] += week[m];
  }
  for (const m of MUSCLES) total[m] /= weeks;
  return total;
}

/** Muscles whose sets fall inside the reference band. */
export function musclesInBand(
  volume: MuscleVolume,
  reference: { min: number; max: number },
): number {
  return MUSCLES.filter((m) => volume[m] >= reference.min && volume[m] <= reference.max).length;
}
