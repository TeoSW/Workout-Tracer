import { mondayOf, type DateStr } from './dates';
import { cyclePosition } from './schedule';
import type { Block, DayTemplate, Exercise, Program } from './schemas';

export const DELOAD_NOTE = 'Stop 2-3 reps or a few seconds before your limit.';

/** A planned deload week (a cycle week in `deloadWeeks`) or one deloaded by hand. */
export function isDeloadWeek(program: Program, date: DateStr): boolean {
  if (program.manualDeloadWeeks.includes(mondayOf(date))) return true;
  const position = cyclePosition(program, date);
  return position !== null && program.deloadWeeks.includes(position.cycleWeek);
}

export function isDeloadDay(program: Program, dayTemplate: DayTemplate, date: DateStr): boolean {
  return !dayTemplate.deloadExempt && isDeloadWeek(program, date);
}

/** 3 becomes 2, 2 becomes 1, 1 stays 1. */
export function halveSets(sets: number): number {
  return Math.ceil(sets / 2);
}

function halveRange<T extends { setsMin: number; setsMax?: number | undefined }>(item: T): T {
  return {
    ...item,
    setsMin: halveSets(item.setsMin),
    ...(item.setsMax === undefined ? {} : { setsMax: halveSets(item.setsMax) }),
  };
}

/** Halves the sets of one block. Targets, loads and bands stay the same. */
export function deloadBlock(block: Block, exercisesById: ReadonlyMap<string, Exercise>): Block {
  const isChecklist =
    block.kind === 'exercise' && exercisesById.get(block.exerciseId)?.trackingType === 'checklist';
  const note = isChecklist
    ? block.note
    : block.note
      ? `${block.note}\n${DELOAD_NOTE}`
      : DELOAD_NOTE;
  const halved = halveRange(structuredClone(block));
  const withNote = note === undefined ? halved : { ...halved, note };
  if (withNote.kind === 'choice') {
    withNote.choiceSlot.options = withNote.choiceSlot.options.map(halveRange);
  }
  return withNote;
}

export function applyDeload(
  blocks: Block[],
  exercisesById: ReadonlyMap<string, Exercise>,
): Block[] {
  return blocks.map((b) => deloadBlock(b, exercisesById));
}

export function addManualDeloadWeek(program: Program, date: DateStr): Program {
  const monday = mondayOf(date);
  if (program.manualDeloadWeeks.includes(monday)) return program;
  return { ...program, manualDeloadWeeks: [...program.manualDeloadWeeks, monday].sort() };
}

export function removeManualDeloadWeek(program: Program, date: DateStr): Program {
  const monday = mondayOf(date);
  return { ...program, manualDeloadWeeks: program.manualDeloadWeeks.filter((d) => d !== monday) };
}
