import { resolveChoice, resolveChoiceBlock } from './choice';
import type { DateStr } from './dates';
import { deloadBlock, isDeloadDay } from './deload';
import { cyclePosition } from './schedule';
import type { Block, DayTemplate, Exercise, PlanSnapshot, Program } from './schemas';

/**
 * Resolves a day template into the plan a session starts with: choice slots picked where a pick
 * exists, then the deload applied. The result is a deep copy, so later program edits never reach
 * a past session.
 */
export function resolvePlan(input: {
  program: Program;
  dayTemplate: DayTemplate;
  date: DateStr;
  exercisesById: ReadonlyMap<string, Exercise>;
}): PlanSnapshot {
  const { program, dayTemplate, date, exercisesById } = input;
  const position = cyclePosition(program, date);
  const isDeload = isDeloadDay(program, dayTemplate, date);

  const blocks = dayTemplate.blocks.map((original): Block => {
    let block: Block = structuredClone(original);
    if (block.kind === 'choice' && position !== null) {
      const resolution = resolveChoice(program, block.choiceSlot.id, position.cycleNumber);
      if (resolution.status === 'picked') block = resolveChoiceBlock(block, resolution.optionIndex);
    }
    return isDeload ? deloadBlock(block, exercisesById) : block;
  });

  return {
    dayTemplateId: dayTemplate.id,
    name: dayTemplate.name,
    dayType: dayTemplate.dayType,
    note: dayTemplate.note,
    isDeload,
    cycleNumber: position?.cycleNumber ?? null,
    cycleWeek: position?.cycleWeek ?? null,
    blocks,
  };
}
