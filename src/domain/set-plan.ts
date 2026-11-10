import type { Block, DayTemplate, SetPlan, SetTarget } from './schemas';

/**
 * The target for working set `index` (from 0): the block's target, with that set's own effort
 * and note on top. A set with no plan of its own uses the block's.
 */
export function targetForSet(
  block: Pick<Block, 'target' | 'setTargets'>,
  index: number,
): SetTarget {
  const plan = block.setTargets?.[index];
  const target = structuredClone(block.target);
  if (plan?.rir !== undefined) target.rir = plan.rir;
  if (plan?.note !== undefined && plan.note !== '') target.note = plan.note;
  return target;
}

/** Sets one set's planned effort or note. Blank fields are dropped, and trailing blanks too. */
export function updateSetPlan(
  day: DayTemplate,
  blockId: string,
  index: number,
  patch: Partial<SetPlan>,
): DayTemplate {
  return {
    ...day,
    blocks: day.blocks.map((b) => {
      if (b.id !== blockId) return b;
      const plans: SetPlan[] = [...(b.setTargets ?? [])];
      while (plans.length <= index) plans.push({});
      const merged: SetPlan = { ...plans[index], ...patch };
      const cleaned: SetPlan = {};
      if (merged.rir !== undefined) cleaned.rir = merged.rir;
      if (merged.note !== undefined && merged.note.trim() !== '') cleaned.note = merged.note.trim();
      plans[index] = cleaned;
      while (plans.length > 0 && Object.keys(plans[plans.length - 1] ?? {}).length === 0) {
        plans.pop();
      }
      const { setTargets: _old, ...rest } = b;
      return (plans.length === 0 ? rest : { ...rest, setTargets: plans }) as Block;
    }),
  };
}
