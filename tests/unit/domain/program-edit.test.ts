import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES } from '../../../src/domain/fixtures/exercises';
import { PROGRAM_A, PROGRAM_C, blankTemplate } from '../../../src/domain/fixtures/templates';
import {
  addExerciseBlock,
  addRotationDay,
  convertSchedule,
  moveBlock,
  moveRotationEntry,
  removeBlock,
  removeRotationEntry,
  resizeCycle,
  setGridDay,
  setSupersetWithNext,
  toggleDeloadWeek,
  updateBlock,
  updateChoiceSlot,
} from '../../../src/domain/program-edit';
import { ProgramSchema, type Block, type DayTemplate } from '../../../src/domain/schemas';
import { activeProgram, counterIds, dayByName } from './helpers';

const exercise = (id: string) => {
  const e = SEED_EXERCISES.find((x) => x.id === id);
  if (!e) throw new Error(`No exercise ${id}`);
  return e;
};
const orders = (day: DayTemplate) => day.blocks.map((b) => b.order);
const ids = (day: DayTemplate) => day.blocks.map((b: Block) => b.id);

describe('cycle and grid edits', () => {
  it('shrinks a cycle, dropping weeks and deload weeks past the end', () => {
    const { program } = activeProgram(PROGRAM_C);
    const shorter = resizeCycle(program, 4);
    expect(shorter.cycleWeeks).toBe(4);
    expect(shorter.deloadWeeks).toEqual([]);
    if (shorter.schedule.kind !== 'weekday') throw new Error('expected weekday grid');
    expect(shorter.schedule.weeks).toHaveLength(4);
    ProgramSchema.parse(shorter);
  });

  it('grows a cycle with rest weeks', () => {
    const { program } = activeProgram(PROGRAM_C);
    const longer = resizeCycle(program, 8);
    if (longer.schedule.kind !== 'weekday') throw new Error('expected weekday grid');
    expect(longer.schedule.weeks).toHaveLength(8);
    expect(Object.values(longer.schedule.weeks[7] ?? {}).every((v) => v === null)).toBe(true);
    expect(longer.deloadWeeks).toEqual([6]);
    ProgramSchema.parse(longer);
  });

  it('sets a rotation cycle length, or clears it and its deloads', () => {
    const { program } = activeProgram(PROGRAM_A);
    const withCycle = toggleDeloadWeek(resizeCycle(program, 4), 4);
    expect(withCycle).toMatchObject({ cycleWeeks: 4, deloadWeeks: [4] });
    ProgramSchema.parse(withCycle);
    expect(resizeCycle(withCycle, null)).toMatchObject({ cycleWeeks: null, deloadWeeks: [] });
  });

  it('refuses to clear the cycle of a weekday grid', () => {
    const { program } = activeProgram(PROGRAM_C);
    expect(() => resizeCycle(program, null)).toThrow();
  });

  it('sets one grid day and leaves the template alone', () => {
    const { program, dayTemplates } = activeProgram(PROGRAM_C);
    const legs = dayByName(dayTemplates, 'Legs');
    const edited = setGridDay(program, 2, 'tue', legs.id);
    if (edited.schedule.kind !== 'weekday' || program.schedule.kind !== 'weekday') {
      throw new Error('expected weekday grid');
    }
    expect(edited.schedule.weeks[2]?.tue).toBe(legs.id);
    expect(edited.schedule.weeks[1]?.tue).toBeNull();
    expect(program.schedule.weeks[2]?.tue).toBeNull();
    const cleared = setGridDay(edited, 2, 'tue', null);
    if (cleared.schedule.kind !== 'weekday') throw new Error('expected weekday grid');
    expect(cleared.schedule.weeks[2]?.tue).toBeNull();
  });

  it('toggles deload weeks and keeps them sorted', () => {
    const { program } = activeProgram(PROGRAM_C);
    expect(toggleDeloadWeek(program, 3).deloadWeeks).toEqual([3, 6]);
    expect(toggleDeloadWeek(program, 6).deloadWeeks).toEqual([]);
  });

  it('converts between a grid and a rotation', () => {
    const blank = activeProgram(blankTemplate('custom')).program;
    const rotation = convertSchedule(blank, 'rotation', ['a', 'b']);
    expect(rotation).toMatchObject({
      cycleWeeks: null,
      deloadWeeks: [],
      schedule: { kind: 'rotation', sequence: ['a', 'b'], sessionsPerWeek: 3 },
    });
    ProgramSchema.parse(rotation);
    const grid = convertSchedule(rotation, 'weekday', ['a', 'b']);
    expect(grid).toMatchObject({ cycleWeeks: 1, schedule: { kind: 'weekday' } });
    ProgramSchema.parse(grid);
    expect(() => convertSchedule(blank, 'rotation', [])).toThrow(
      'Add a day before switching to a rotation.',
    );
    expect(convertSchedule(blank, 'weekday', [])).toBe(blank);
  });
});

describe('rotation edits', () => {
  const { program } = activeProgram(PROGRAM_A);
  const sequence = (p: typeof program) => {
    if (p.schedule.kind !== 'rotation') throw new Error('expected rotation');
    return p.schedule.sequence;
  };
  const [a, b, c, d] = sequence(program);

  it('adds a day, allowing repeats', () => {
    expect(sequence(addRotationDay(program, a ?? ''))).toEqual([a, b, c, d, a]);
  });

  it('moves an entry and stops at the ends', () => {
    expect(sequence(moveRotationEntry(program, 0, 'down'))).toEqual([b, a, c, d]);
    expect(sequence(moveRotationEntry(program, 0, 'up'))).toEqual([a, b, c, d]);
    expect(sequence(moveRotationEntry(program, 3, 'down'))).toEqual([a, b, c, d]);
  });

  it('removes an entry but never the last one', () => {
    expect(sequence(removeRotationEntry(program, 1))).toEqual([a, c, d]);
    const single = { ...program, schedule: { ...program.schedule, sequence: [a ?? ''] } };
    expect(() => removeRotationEntry(single as typeof program, 0)).toThrow(
      'A rotation needs at least one day.',
    );
  });
});

describe('block edits', () => {
  const { dayTemplates } = activeProgram(PROGRAM_C);
  const heavy = dayByName(dayTemplates, 'Heavy (planche first)');
  const legs = dayByName(dayTemplates, 'Legs');

  it('adds blocks with defaults that fit the tracking type', () => {
    const newId = counterIds('b');
    const added = addExerciseBlock(legs, exercise('squat'), newId);
    expect(added.blocks.at(-1)).toMatchObject({
      kind: 'exercise',
      exerciseId: 'squat',
      setsMin: 3,
      order: 10,
      target: { repsMin: 8, repsMax: 12 },
      warmupSets: 0,
    });
    expect(addExerciseBlock(legs, exercise('warm-up'), newId).blocks.at(-1)).toMatchObject({
      setsMin: 1,
      target: {},
    });
    expect(addExerciseBlock(legs, exercise('540'), newId).blocks.at(-1)).toMatchObject({
      setsMin: 1,
      target: { attemptsMin: 4, attemptsMax: 6 },
    });
    expect(addExerciseBlock(legs, exercise('plank'), newId).blocks.at(-1)).toMatchObject({
      target: { secondsMin: 30, secondsMax: 45 },
    });
    expect(legs.blocks).toHaveLength(10);
  });

  it('moves and removes blocks and keeps orders contiguous', () => {
    const moved = moveBlock(legs, legs.blocks[1]?.id ?? '', 'up');
    expect(ids(moved).slice(0, 2)).toEqual([legs.blocks[1]?.id, legs.blocks[0]?.id]);
    expect(orders(moved)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(moveBlock(legs, legs.blocks[0]?.id ?? '', 'up')).toBe(legs);

    const removed = removeBlock(legs, legs.blocks[2]?.id ?? '');
    expect(orders(removed)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('updates a block', () => {
    const edited = updateBlock(legs, legs.blocks[0]?.id ?? '', { setsMin: 5, restSec: 45 });
    expect(edited.blocks[0]).toMatchObject({ setsMin: 5, restSec: 45 });
    expect(legs.blocks[0]?.setsMin).toBe(3);
  });

  it('links a block with the next one as a superset and unlinks it', () => {
    const newId = counterIds('g');
    const first = legs.blocks[0]?.id ?? '';
    const second = legs.blocks[1]?.id ?? '';
    const third = legs.blocks[2]?.id ?? '';
    const linked = setSupersetWithNext(legs, first, true, newId);
    expect(linked.blocks[0]?.supersetGroup).toBe('g-1');
    expect(linked.blocks[1]?.supersetGroup).toBe('g-1');

    const triple = setSupersetWithNext(linked, second, true, newId);
    expect(triple.blocks[2]?.supersetGroup).toBe('g-1');

    const unlinked = setSupersetWithNext(triple, second, false, newId);
    expect(unlinked.blocks.find((b) => b.id === third)?.supersetGroup).toBeUndefined();
    expect(unlinked.blocks.find((b) => b.id === second)?.supersetGroup).toBe('g-1');

    const last = legs.blocks.at(-1)?.id ?? '';
    expect(setSupersetWithNext(legs, last, true, newId)).toBe(legs);
  });

  it('changes a shared choice slot on every day that uses it', () => {
    const block = heavy.blocks.find((b) => b.kind === 'choice');
    if (block?.kind !== 'choice') throw new Error('missing choice block');
    const slot = { ...block.choiceSlot, label: 'Accessory' };
    const changed = updateChoiceSlot(dayTemplates, slot);
    expect(changed.map((d) => d.name).sort()).toEqual([
      'Heavy (front lever first)',
      'Heavy (planche first)',
    ]);
    for (const d of changed) {
      const b = d.blocks.find((x) => x.kind === 'choice');
      expect(b?.kind === 'choice' && b.choiceSlot.label).toBe('Accessory');
    }
  });
});
