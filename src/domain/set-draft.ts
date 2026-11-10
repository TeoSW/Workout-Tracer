import type { Exercise, LoggedPart, LoggedSet, SetTarget } from './schemas';

/** What the set sheet edits. Holds every value a set can have; the tracking type picks which count. */
export type SetDraft = {
  kg?: number | undefined;
  addedKg?: number | undefined;
  bandIds: string[];
  reps?: number | undefined;
  seconds?: number | undefined;
  progressionLevel?: string | undefined;
  parts: LoggedPart[];
  attempts: number;
  cleanAttempts: number;
  clean: boolean;
  rir: number | null;
};

function partsFor(target: SetTarget, last: LoggedSet | null): LoggedPart[] {
  return (target.parts ?? []).map((p) => {
    const logged = last?.parts?.find((l) => l.name === p.name && l.unit === p.unit);
    return { name: p.name, unit: p.unit, value: logged?.value ?? p.target };
  });
}

/** Prefills from last time, otherwise from the lower end of the plan. Effort comes from the plan first. */
export function draftFor(input: {
  exercise: Exercise;
  target: SetTarget;
  last: LoggedSet | null;
}): SetDraft {
  const { target, last } = input;
  const plannedLevel = target.progressionLevel === 'current' ? undefined : target.progressionLevel;
  return {
    kg: last?.kg ?? target.loadMinKg,
    addedKg: last ? last.addedKg : target.addedKg,
    bandIds: [...(last ? (last.bandIds ?? []) : (target.bandIds ?? []))],
    reps: last?.reps ?? target.repsMin,
    seconds: last?.seconds ?? target.secondsMin,
    progressionLevel: last?.progressionLevel ?? plannedLevel,
    parts: partsFor(target, last),
    attempts: 0,
    cleanAttempts: 0,
    clean: last?.clean ?? false,
    // The planned effort is the goal for today, so it comes before last time's.
    rir: target.rir ?? last?.rir ?? null,
  };
}

/** Why a draft cannot be saved yet, or null when it can. */
export function draftProblem(draft: SetDraft, exercise: Exercise): string | null {
  switch (exercise.trackingType) {
    case 'weight_reps':
    case 'bodyweight_reps':
      return (draft.reps ?? 0) > 0 ? null : 'Enter the reps.';
    case 'hold':
      return (draft.seconds ?? 0) > 0 ? null : 'Enter the seconds.';
    case 'attempts':
      return draft.attempts > 0 ? null : 'Log at least one attempt.';
    default:
      return null;
  }
}

/** The values to store for a finished set, for this exercise's tracking type only. */
export function draftToPatch(draft: SetDraft, exercise: Exercise): Partial<LoggedSet> {
  switch (exercise.trackingType) {
    case 'weight_reps':
      return { kg: draft.kg ?? 0, reps: draft.reps ?? 0, rir: draft.rir, done: true };
    case 'bodyweight_reps': {
      const banded = draft.bandIds.length > 0;
      return {
        reps: draft.reps ?? 0,
        rir: draft.rir,
        bandIds: banded ? draft.bandIds : undefined,
        addedKg: banded ? undefined : draft.addedKg,
        done: true,
      };
    }
    case 'hold':
      return {
        seconds: draft.seconds ?? 0,
        progressionLevel: draft.progressionLevel,
        bandIds: draft.bandIds.length > 0 ? draft.bandIds : undefined,
        clean: draft.clean,
        rir: null,
        done: true,
      };
    case 'complex':
      return {
        parts: draft.parts,
        progressionLevel: draft.progressionLevel,
        bandIds: draft.bandIds.length > 0 ? draft.bandIds : undefined,
        clean: draft.clean,
        rir: null,
        done: true,
      };
    case 'attempts':
      return {
        attempts: draft.attempts,
        cleanAttempts: draft.cleanAttempts,
        rir: null,
        done: true,
      };
    case 'checklist':
      return { rir: null, done: true };
  }
}

/** Reopens a set that is already logged, with its own values. */
export function draftFromSet(set: LoggedSet, exercise: Exercise): SetDraft {
  return {
    ...draftFor({ exercise, target: set.target ?? {}, last: set }),
    parts: set.parts ?? [],
    attempts: set.attempts ?? 0,
    cleanAttempts: set.cleanAttempts ?? 0,
  };
}
