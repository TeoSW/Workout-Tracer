import type { Block, ChoiceBlock, ChoiceSlot, DayTemplate, Program } from './schemas';

export type ChoiceResolution = { status: 'picked'; optionIndex: number } | { status: 'needs_pick' };

/** The pick for this cycle, otherwise the latest earlier pick, otherwise "needs pick". */
export function resolveChoice(
  program: Program,
  slotId: string,
  cycleNumber: number,
): ChoiceResolution {
  let best: { cycleNumber: number; optionIndex: number } | null = null;
  for (const s of program.choiceSelections) {
    if (s.slotId !== slotId || s.cycleNumber > cycleNumber) continue;
    if (best === null || s.cycleNumber > best.cycleNumber) best = s;
  }
  return best === null
    ? { status: 'needs_pick' }
    : { status: 'picked', optionIndex: best.optionIndex };
}

/** Saves a pick for one cycle, replacing an earlier pick for the same cycle and slot. */
export function saveChoice(
  program: Program,
  slotId: string,
  cycleNumber: number,
  optionIndex: number,
): Program {
  return {
    ...program,
    choiceSelections: [
      ...program.choiceSelections.filter(
        (s) => !(s.slotId === slotId && s.cycleNumber === cycleNumber),
      ),
      { cycleNumber, slotId, optionIndex },
    ],
  };
}

/**
 * Keeps saved picks right after an option is removed from a slot: picks of that option go, so
 * the logger asks again, and picks of later options move down one.
 */
export function removeOptionFromSelections(
  program: Program,
  slotId: string,
  optionIndex: number,
): Program {
  return {
    ...program,
    choiceSelections: program.choiceSelections.flatMap((s) => {
      if (s.slotId !== slotId || s.optionIndex < optionIndex) return [s];
      return s.optionIndex === optionIndex ? [] : [{ ...s, optionIndex: s.optionIndex - 1 }];
    }),
  };
}

/** The test flow picks for the next cycle. A test before the first week counts for cycle 1. */
export function testFlowTargetCycle(cycleNumber: number): number {
  return Math.max(cycleNumber, 0) + 1;
}

/** Turns a choice block into an exercise block for the picked option. */
export function resolveChoiceBlock(block: ChoiceBlock, optionIndex: number): Block {
  const option = block.choiceSlot.options[optionIndex];
  if (!option) throw new Error(`Choice ${block.choiceSlot.id} has no option ${optionIndex}`);
  return {
    kind: 'exercise',
    id: block.id,
    order: block.order,
    exerciseId: option.exerciseId,
    setsMin: option.setsMin,
    ...(option.setsMax === undefined ? {} : { setsMax: option.setsMax }),
    target: structuredClone(option.target),
    warmupSets: block.warmupSets,
    ...(block.restSec === undefined ? {} : { restSec: block.restSec }),
    ...(block.supersetGroup === undefined ? {} : { supersetGroup: block.supersetGroup }),
    ...(block.note === undefined ? {} : { note: block.note }),
    fromSlotId: block.choiceSlot.id,
    optionIndex,
  };
}

/** The distinct choice slots of a program. Days can share one slot. */
export function programChoiceSlots(days: readonly DayTemplate[]): ChoiceSlot[] {
  const slots = new Map<string, ChoiceSlot>();
  for (const day of days) {
    for (const block of day.blocks) {
      if (block.kind === 'choice') slots.set(block.choiceSlot.id, block.choiceSlot);
    }
  }
  return [...slots.values()];
}
