import { resolveChoice, resolveChoiceBlock } from './choice';
import { mondayOf, type DateStr } from './dates';
import { deloadBlock, isDeloadDay } from './deload';
import { cyclePosition } from './schedule';
import type { Block, DayTemplate, Exercise, PlanSnapshot, Program } from './schemas';

/**
 * Resolves a day template into the plan a session starts with: choice slots picked where a pick
 * exists, then the deload applied. The result is a deep copy, so later program edits never reach
 * a past session. `cycleWeek` trains the day as that week of the cycle instead of the calendar's.
 */
export function resolvePlan(input: {
  program: Program;
  dayTemplate: DayTemplate;
  date: DateStr;
  exercisesById: ReadonlyMap<string, Exercise>;
  cycleWeek?: number;
}): PlanSnapshot {
  const { program, dayTemplate, date, exercisesById, cycleWeek } = input;
  const calendar = cyclePosition(program, date);
  const position =
    calendar !== null && cycleWeek !== undefined ? { ...calendar, cycleWeek } : calendar;
  const isDeload =
    cycleWeek === undefined
      ? isDeloadDay(program, dayTemplate, date)
      : !dayTemplate.deloadExempt &&
        (program.deloadWeeks.includes(cycleWeek) ||
          program.manualDeloadWeeks.includes(mondayOf(date)));

  const blocks = dayTemplate.blocks.map((original): Block => {
    let block: Block = structuredClone(original);
    if (block.kind === 'choice' && position !== null) {
      const resolution = resolveChoice(program, block.choiceSlot.id, position.cycleNumber);
      // A pick that no longer has an option counts as no pick, so the logger asks again.
      if (resolution.status === 'picked' && block.choiceSlot.options[resolution.optionIndex]) {
        block = resolveChoiceBlock(block, resolution.optionIndex);
      }
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
