import type { Block, DayTemplate, LoggedSet, SetPlan, SetTarget } from './schemas';
import type { NewId } from './templates';

/** What a logged set becomes as a target: the same reps, load, band, time and parts. */
function targetFromSet(set: LoggedSet): SetTarget {
  const target: SetTarget = {};
  if (set.reps !== undefined) target.repsMin = set.reps;
  if (set.kg !== undefined) target.loadMinKg = set.kg;
  if (set.addedKg !== undefined) target.addedKg = set.addedKg;
  if (set.bandIds !== undefined) target.bandIds = [...set.bandIds];
  if (set.seconds !== undefined) target.secondsMin = Math.round(set.seconds);
  if (set.parts !== undefined) {
    target.parts = set.parts.map((p) => ({ name: p.name, unit: p.unit, target: p.value }));
  }
  if (set.progressionLevel !== undefined) target.progressionLevel = set.progressionLevel;
  if (set.attempts !== undefined && set.attempts > 0) {
    target.attemptsMin = set.attempts;
    target.attemptsMax = set.attempts;
  }
  return target;
}

/**
 * A program day made from a workout: one block per exercise, with as many sets as were done,
 * aimed at the first working set's values. Each set keeps its effort and note as its own plan.
 */
export function dayFromSession(input: {
  exercises: readonly { exerciseId: string; order: number; note: string; sets: LoggedSet[] }[];
  programId: string;
  name: string;
  newId: NewId;
}): DayTemplate {
  const dayId = input.newId();
  const blocks: Block[] = [];
  for (const entry of [...input.exercises].sort((a, b) => a.order - b.order)) {
    const sets = [...entry.sets].sort((a, b) => a.order - b.order);
    const done = sets.filter((s) => s.done);
    const working = (done.length > 0 ? done : sets).filter((s) => s.kind === 'working');
    const warmups = (done.length > 0 ? done : sets).filter((s) => s.kind === 'warmup').length;
    const first = working[0];
    if (!first) continue;
    const plans: SetPlan[] = working.map((s) => ({
      ...(s.rir === null ? {} : { rir: s.rir }),
      ...(s.note === undefined || s.note === '' ? {} : { note: s.note }),
    }));
    const hasPlans = plans.some((p) => Object.keys(p).length > 0);
    blocks.push({
      kind: 'exercise',
      id: input.newId(),
      order: blocks.length,
      exerciseId: entry.exerciseId,
      setsMin: working.length,
      // Done sets give real values; a workout with nothing logged keeps its plan.
      target: done.length > 0 ? targetFromSet(first) : structuredClone(first.target ?? {}),
      warmupSets: warmups,
      ...(entry.note === '' ? {} : { note: entry.note }),
      ...(hasPlans ? { setTargets: plans } : {}),
    });
  }
  return {
    id: dayId,
    programId: input.programId,
    name: input.name,
    dayType: 'custom',
    deloadExempt: false,
    note: '',
    blocks,
  };
}
