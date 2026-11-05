import { REST_WEEK } from './fixtures/builders';
import type { Weekday } from './dates';
import type {
  Block,
  ChoiceSlot,
  DayTemplate,
  Exercise,
  ExerciseBlock,
  Program,
  SetTarget,
} from './schemas';
import type { NewId } from './templates';

/** Pure edits for the program and day editors. Each returns a new record. */

export type Direction = 'up' | 'down';

function move<T>(items: readonly T[], index: number, direction: Direction): T[] | null {
  const other = direction === 'up' ? index - 1 : index + 1;
  const a = items[index];
  const b = items[other];
  if (a === undefined || b === undefined) return null;
  const copy = [...items];
  copy[index] = b;
  copy[other] = a;
  return copy;
}

/** Sets the cycle length. A grid grows with rest weeks; deload weeks past the end are dropped. */
export function resizeCycle(program: Program, weeks: number | null): Program {
  const deloadWeeks = weeks === null ? [] : program.deloadWeeks.filter((w) => w <= weeks);
  if (program.schedule.kind === 'rotation') return { ...program, cycleWeeks: weeks, deloadWeeks };
  if (weeks === null) throw new Error('A weekday grid needs a cycle length.');
  const grid = program.schedule.weeks.slice(0, weeks);
  while (grid.length < weeks) grid.push({ ...REST_WEEK });
  return { ...program, cycleWeeks: weeks, deloadWeeks, schedule: { kind: 'weekday', weeks: grid } };
}

export function setGridDay(
  program: Program,
  weekIndex: number,
  weekday: Weekday,
  dayTemplateId: string | null,
): Program {
  if (program.schedule.kind !== 'weekday') throw new Error('Not a weekday grid');
  const weeks = program.schedule.weeks.map((w, i) =>
    i === weekIndex ? { ...w, [weekday]: dayTemplateId } : w,
  );
  return { ...program, schedule: { kind: 'weekday', weeks } };
}

export function toggleDeloadWeek(program: Program, week: number): Program {
  const has = program.deloadWeeks.includes(week);
  const deloadWeeks = has
    ? program.deloadWeeks.filter((w) => w !== week)
    : [...program.deloadWeeks, week].sort((a, b) => a - b);
  return { ...program, deloadWeeks };
}

/** Switches between a weekday grid and a rotation. The new schedule starts from the program's days. */
export function convertSchedule(
  program: Program,
  kind: 'weekday' | 'rotation',
  dayIds: readonly string[],
): Program {
  if (program.schedule.kind === kind) return program;
  if (kind === 'weekday') {
    return {
      ...program,
      cycleWeeks: 1,
      deloadWeeks: [],
      schedule: { kind: 'weekday', weeks: [{ ...REST_WEEK }] },
    };
  }
  if (dayIds.length === 0) throw new Error('Add a day before switching to a rotation.');
  return {
    ...program,
    cycleWeeks: null,
    deloadWeeks: [],
    schedule: { kind: 'rotation', sequence: [...dayIds], sessionsPerWeek: 3 },
  };
}

function withSequence(program: Program, sequence: string[]): Program {
  if (program.schedule.kind !== 'rotation') throw new Error('Not a rotation');
  return { ...program, schedule: { ...program.schedule, sequence } };
}

function sequenceOf(program: Program): string[] {
  if (program.schedule.kind !== 'rotation') throw new Error('Not a rotation');
  return program.schedule.sequence;
}

export function addRotationDay(program: Program, dayTemplateId: string): Program {
  return withSequence(program, [...sequenceOf(program), dayTemplateId]);
}

export function removeRotationEntry(program: Program, index: number): Program {
  const sequence = sequenceOf(program);
  if (sequence.length === 1) throw new Error('A rotation needs at least one day.');
  return withSequence(
    program,
    sequence.filter((_, i) => i !== index),
  );
}

export function moveRotationEntry(program: Program, index: number, direction: Direction): Program {
  const moved = move(sequenceOf(program), index, direction);
  return moved ? withSequence(program, moved) : program;
}

function sortedBlocks(day: DayTemplate): Block[] {
  return [...day.blocks].sort((a, b) => a.order - b.order);
}

function withBlocks(day: DayTemplate, blocks: Block[]): DayTemplate {
  return { ...day, blocks: blocks.map((b, order) => ({ ...b, order })) };
}

function defaultsFor(exercise: Exercise): { setsMin: number; target: SetTarget } {
  switch (exercise.trackingType) {
    case 'checklist':
      return { setsMin: 1, target: {} };
    case 'attempts':
      return { setsMin: 1, target: { attemptsMin: 4, attemptsMax: 6 } };
    case 'hold':
      return { setsMin: 3, target: { secondsMin: 30, secondsMax: 45 } };
    case 'complex':
      return { setsMin: 3, target: { parts: [] } };
    default:
      return { setsMin: 3, target: { repsMin: 8, repsMax: 12 } };
  }
}

export function addExerciseBlock(day: DayTemplate, exercise: Exercise, newId: NewId): DayTemplate {
  const block: ExerciseBlock = {
    kind: 'exercise',
    id: newId(),
    order: day.blocks.length,
    exerciseId: exercise.id,
    warmupSets: 0,
    ...defaultsFor(exercise),
  };
  return withBlocks(day, [...sortedBlocks(day), block]);
}

/** Adds a choice slot with its first option. The label and options are edited afterwards. */
export function addChoiceBlock(day: DayTemplate, exercise: Exercise, newId: NewId): DayTemplate {
  const defaults = defaultsFor(exercise);
  const block: Block = {
    kind: 'choice',
    id: newId(),
    order: day.blocks.length,
    setsMin: defaults.setsMin,
    target: {},
    warmupSets: 0,
    choiceSlot: {
      id: newId(),
      label: 'Choice',
      options: [{ exerciseId: exercise.id, ...defaults, pickWhen: '' }],
    },
  };
  return withBlocks(day, [...sortedBlocks(day), block]);
}

export function removeBlock(day: DayTemplate, blockId: string): DayTemplate {
  return withBlocks(
    day,
    sortedBlocks(day).filter((b) => b.id !== blockId),
  );
}

export function moveBlock(day: DayTemplate, blockId: string, direction: Direction): DayTemplate {
  const blocks = sortedBlocks(day);
  const moved = move(
    blocks,
    blocks.findIndex((b) => b.id === blockId),
    direction,
  );
  return moved ? withBlocks(day, moved) : day;
}

export function updateBlock(
  day: DayTemplate,
  blockId: string,
  patch: Partial<Omit<ExerciseBlock, 'kind' | 'id'>>,
): DayTemplate {
  return {
    ...day,
    blocks: day.blocks.map((b) => (b.id === blockId ? ({ ...b, ...patch } as Block) : b)),
  };
}

function withoutGroup(block: Block): Block {
  const copy = { ...block };
  delete copy.supersetGroup;
  return copy;
}

/**
 * Links a block with the one after it as a superset, or breaks that link. Blocks left alone in a
 * group leave it.
 */
export function setSupersetWithNext(
  day: DayTemplate,
  blockId: string,
  on: boolean,
  newId: NewId,
): DayTemplate {
  const blocks = sortedBlocks(day);
  const index = blocks.findIndex((b) => b.id === blockId);
  const block = blocks[index];
  const next = blocks[index + 1];
  if (!block || !next) return day;

  if (on) {
    const group = block.supersetGroup ?? next.supersetGroup ?? newId();
    blocks[index] = { ...block, supersetGroup: group };
    blocks[index + 1] = { ...next, supersetGroup: group };
    return withBlocks(day, blocks);
  }

  const group = block.supersetGroup;
  if (group === undefined || next.supersetGroup !== group) return day;
  for (let i = index + 1; blocks[i]?.supersetGroup === group; i++) {
    blocks[i] = withoutGroup(blocks[i] as Block);
  }
  if (blocks[index - 1]?.supersetGroup !== group) blocks[index] = withoutGroup(block);
  return withBlocks(day, blocks);
}

/** The days that use a choice slot, with the slot replaced. Heavy days share one slot. */
export function updateChoiceSlot(days: readonly DayTemplate[], slot: ChoiceSlot): DayTemplate[] {
  return days
    .filter((d) => d.blocks.some((b) => b.kind === 'choice' && b.choiceSlot.id === slot.id))
    .map((d) => ({
      ...d,
      blocks: d.blocks.map((b) =>
        b.kind === 'choice' && b.choiceSlot.id === slot.id ? { ...b, choiceSlot: slot } : b,
      ),
    }));
}
