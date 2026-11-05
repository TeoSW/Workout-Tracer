import type { Block, ChoiceBlock, LoggedSet, SessionExercise } from './schemas';
import { countsForStats } from './sets';

type LogExercise = Pick<SessionExercise, 'id' | 'order' | 'blockId'>;

export type LogItem<E extends LogExercise> =
  | { kind: 'exercises'; order: number; exercises: E[] }
  | { kind: 'choice'; order: number; block: ChoiceBlock };

/**
 * What the logger shows, in order: one card per exercise, joined cards for neighbours in a
 * superset, and a card for each choice not picked yet.
 */
export function logItems<E extends LogExercise>(
  exercises: readonly E[],
  blocks: readonly Block[],
): LogItem<E>[] {
  const groupOf = (e: E) => blocks.find((b) => b.id === e.blockId)?.supersetGroup;
  const items: LogItem<E>[] = [
    ...blocks.flatMap((block) =>
      block.kind === 'choice' ? [{ kind: 'choice' as const, order: block.order, block }] : [],
    ),
  ];

  let lastGroup: string | undefined;
  const sorted = [...exercises].sort((a, b) => a.order - b.order);
  for (const exercise of sorted) {
    const group = groupOf(exercise);
    const previous = items.at(-1);
    const lastOrder = previous?.kind === 'exercises' ? previous.exercises.at(-1)?.order : undefined;
    const choiceBetween = blocks.some(
      (b) => b.kind === 'choice' && b.order > (lastOrder ?? 0) && b.order < exercise.order,
    );
    if (
      group !== undefined &&
      lastGroup === group &&
      previous?.kind === 'exercises' &&
      !choiceBetween
    ) {
      previous.exercises.push(exercise);
    } else {
      items.push({ kind: 'exercises', order: exercise.order, exercises: [exercise] });
    }
    lastGroup = group;
  }
  return items.sort((a, b) => a.order - b.order);
}

/** "Set 2" or "Warm-up 1", with the number used for the last-time lookup. */
export function setLabel(
  sets: readonly LoggedSet[],
  set: LoggedSet,
): { text: string; number: number } {
  const number =
    sets
      .filter((s) => s.kind === set.kind)
      .sort((a, b) => a.order - b.order)
      .findIndex((s) => s.id === set.id) + 1;
  return { text: `${set.kind === 'warmup' ? 'Warm-up' : 'Set'} ${number}`, number };
}

export function workingSetsDone(sets: readonly LoggedSet[]): number {
  return sets.filter(countsForStats).length;
}
