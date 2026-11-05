import type { Block, Exercise, SessionExercise } from './schemas';

/**
 * Seconds to rest after a set of this session exercise, or null for no rest: inside a superset
 * round rest waits for the last exercise of the round, and a rest of 0 starts no timer.
 */
export function restAfterSet(input: {
  blocks: readonly Block[];
  sessionExercises: readonly Pick<SessionExercise, 'id' | 'exerciseId' | 'order' | 'blockId'>[];
  sessionExerciseId: string;
  exercisesById: ReadonlyMap<string, Exercise>;
}): number | null {
  const { blocks, sessionExercises, sessionExerciseId, exercisesById } = input;
  const current = sessionExercises.find((e) => e.id === sessionExerciseId);
  if (!current) return null;
  const blockOf = (blockId: string | null) => blocks.find((b) => b.id === blockId);
  const block = blockOf(current.blockId);

  if (block?.supersetGroup !== undefined) {
    const round = sessionExercises
      .filter((e) => blockOf(e.blockId)?.supersetGroup === block.supersetGroup)
      .sort((a, b) => a.order - b.order);
    if (round.at(-1)?.id !== current.id) return null;
  }

  const seconds = block?.restSec ?? exercisesById.get(current.exerciseId)?.defaultRestSec ?? 0;
  return seconds > 0 ? seconds : null;
}
