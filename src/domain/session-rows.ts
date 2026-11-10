import type { ExerciseBlock, LoggedSet, PlanSnapshot, SessionExercise } from './schemas';
import { targetForSet } from './set-plan';
import type { NewId } from './templates';

/**
 * The session exercise and empty set rows for one block: `warmupSets` warm-ups, then `setsMin`
 * working sets, each with its own copy of the target. Set `order` counts within the exercise.
 */
export function buildRowsForBlock(input: {
  sessionId: string;
  block: ExerciseBlock;
  order: number;
  newId: NewId;
}): { sessionExercise: SessionExercise; sets: LoggedSet[] } {
  const { sessionId, block, newId } = input;
  const sessionExercise: SessionExercise = {
    id: newId(),
    sessionId,
    exerciseId: block.exerciseId,
    order: input.order,
    blockId: block.id,
    swappedFromExerciseId: null,
    note: '',
  };
  const kinds = [
    ...Array.from({ length: block.warmupSets }, () => 'warmup' as const),
    ...Array.from({ length: block.setsMin }, () => 'working' as const),
  ];
  const sets = kinds.map((kind, order): LoggedSet => ({
    id: newId(),
    sessionId,
    sessionExerciseId: sessionExercise.id,
    exerciseId: block.exerciseId,
    order,
    kind,
    // Warm-ups take the block's target; working sets add their own effort and note.
    target:
      kind === 'warmup'
        ? structuredClone(block.target)
        : targetForSet(block, order - block.warmupSets),
    rir: null,
    done: false,
    completedAt: null,
  }));
  return { sessionExercise, sets };
}

/**
 * Rows for every exercise block of a plan. A choice block without a pick gets no rows until it is
 * picked; exercise order follows block order, so a later pick slots into its place.
 */
export function buildSessionRows(input: {
  sessionId: string;
  snapshot: PlanSnapshot;
  newId: NewId;
}): { sessionExercises: SessionExercise[]; sets: LoggedSet[] } {
  const sessionExercises: SessionExercise[] = [];
  const sets: LoggedSet[] = [];
  for (const block of input.snapshot.blocks) {
    if (block.kind !== 'exercise') continue;
    const rows = buildRowsForBlock({
      sessionId: input.sessionId,
      block,
      order: block.order,
      newId: input.newId,
    });
    sessionExercises.push(rows.sessionExercise);
    sets.push(...rows.sets);
  }
  return { sessionExercises, sets };
}
