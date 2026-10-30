import { describe, expect, it } from 'vitest';
import { resolveChoice, saveChoice, testFlowTargetCycle } from '../../../src/domain/choice';
import { addDays, mondayOf } from '../../../src/domain/dates';
import {
  DELOAD_NOTE,
  addManualDeloadWeek,
  applyDeload,
  halveSets,
  isDeloadDay,
  isDeloadWeek,
  removeManualDeloadWeek,
} from '../../../src/domain/deload';
import { SEED_EXERCISES } from '../../../src/domain/fixtures/exercises';
import { PROGRAM_A, PROGRAM_C } from '../../../src/domain/fixtures/templates';
import { resolvePlan } from '../../../src/domain/plan';
import type { Block, DayTemplate, Program } from '../../../src/domain/schemas';
import { ANCHOR, activeProgram, dayByName } from './helpers';

const exercisesById = new Map(SEED_EXERCISES.map((e) => [e.id, e]));
const D = ANCHOR;
const WEEK_6 = addDays(D, 35);

function setsOf(blocks: Block[]) {
  return blocks.map((b) => [
    b.kind === 'exercise' ? b.exerciseId : 'choice',
    b.setsMin,
    b.setsMax ?? null,
  ]);
}

function slotIdOf(day: DayTemplate): string {
  const block = day.blocks.find((b) => b.kind === 'choice');
  if (block?.kind !== 'choice') throw new Error('no choice block');
  return block.choiceSlot.id;
}

describe('halveSets', () => {
  it('rounds up', () => {
    expect([1, 2, 3, 4].map(halveSets)).toEqual([1, 1, 2, 2]);
  });
});

describe('acceptance 4: Program C week 6 deload', () => {
  const { program, dayTemplates } = activeProgram(PROGRAM_C);
  const plan = (name: string, date = WEEK_6) =>
    resolvePlan({ program, dayTemplate: dayByName(dayTemplates, name), date, exercisesById });

  it('halves the Heavy days', () => {
    for (const name of ['Heavy (planche first)', 'Heavy (front lever first)']) {
      const snapshot = plan(name);
      expect(snapshot.isDeload).toBe(true);
      const sets = Object.fromEntries(setsOf(snapshot.blocks).map(([id, min]) => [id, min]));
      expect(sets).toEqual({
        'warm-up': 1,
        'planche-complex': 2,
        'front-lever-complex': 2,
        choice: 2,
        'weighted-dips': 1,
        'weighted-pull-ups': 1,
        'lateral-raise': 2,
        'bicep-curl': 1,
      });
      const choiceBlock = snapshot.blocks.find((b) => b.kind === 'choice');
      if (choiceBlock?.kind !== 'choice') throw new Error('expected an unresolved choice');
      expect(choiceBlock.choiceSlot.options.map((o) => o.setsMin)).toEqual([2, 2, 2]);
    }
  });

  it('turns 3-4 light-day holds into 2', () => {
    for (const name of ['Light (front lever first)', 'Light (planche first)']) {
      const holds = plan(name).blocks.filter(
        (b) => b.kind === 'exercise' && b.exerciseId !== 'warm-up',
      );
      expect(holds.map((b) => [b.setsMin, b.setsMax])).toEqual([
        [2, 2],
        [2, 2],
      ]);
    }
  });

  it('keeps targets, loads and bands, adds the note, and leaves warm-ups alone', () => {
    const template = dayByName(dayTemplates, 'Heavy (planche first)');
    const snapshot = plan('Heavy (planche first)');
    snapshot.blocks.forEach((block, i) => {
      const original = template.blocks[i];
      if (!original) throw new Error('missing block');
      expect(block.target).toEqual(original.target);
      if (block.kind === 'exercise' && block.exerciseId === 'warm-up') {
        expect(block.note).toBe(original.note);
      } else {
        expect(block.note?.endsWith(DELOAD_NOTE)).toBe(true);
        if (original.note) expect(block.note).toBe(`${original.note}\n${DELOAD_NOTE}`);
      }
    });
  });

  it('leaves Legs and Test unchanged', () => {
    for (const name of ['Legs', 'Test']) {
      const snapshot = plan(name, name === 'Test' ? addDays(D, 40) : addDays(D, 41));
      expect(snapshot.isDeload).toBe(false);
      expect(snapshot.blocks).toEqual(dayByName(dayTemplates, name).blocks);
    }
  });

  it('does not deload weeks 1 to 5', () => {
    for (let w = 0; w < 5; w++) expect(isDeloadWeek(program, addDays(D, w * 7 + 3))).toBe(false);
    expect(isDeloadWeek(program, addDays(D, 41))).toBe(true);
    expect(isDeloadWeek(program, addDays(D, 42))).toBe(false);
    expect(isDeloadWeek(program, addDays(D, 42 + 35))).toBe(true);
  });
});

describe('acceptance 5: deload this week', () => {
  it('applies the same transform to that week only', () => {
    const { program: base, dayTemplates } = activeProgram(PROGRAM_A);
    const today = addDays(D, 16); // Wednesday of week 3
    const program = addManualDeloadWeek(base, today);
    expect(program.manualDeloadWeeks).toEqual([mondayOf(today)]);
    expect(base.manualDeloadWeeks).toEqual([]);

    const upperA = dayByName(dayTemplates, 'Upper A');
    for (const offset of [14, 16, 20])
      expect(isDeloadDay(program, upperA, addDays(D, offset))).toBe(true);
    for (const offset of [13, 21])
      expect(isDeloadDay(program, upperA, addDays(D, offset))).toBe(false);

    const snapshot = resolvePlan({ program, dayTemplate: upperA, date: today, exercisesById });
    expect(snapshot.isDeload).toBe(true);
    expect(snapshot.blocks).toEqual(applyDeload(upperA.blocks, exercisesById));
    expect(snapshot.blocks.every((b) => b.setsMin === 2)).toBe(true);

    const notDeloaded = resolvePlan({
      program,
      dayTemplate: upperA,
      date: addDays(D, 21),
      exercisesById,
    });
    expect(notDeloaded.blocks).toEqual(upperA.blocks);

    expect(removeManualDeloadWeek(program, addDays(D, 20)).manualDeloadWeeks).toEqual([]);
    expect(addManualDeloadWeek(program, today).manualDeloadWeeks).toHaveLength(1);
  });

  it('respects deloadExempt', () => {
    const { program: base, dayTemplates } = activeProgram(PROGRAM_C);
    const program = addManualDeloadWeek(base, D);
    expect(isDeloadDay(program, dayByName(dayTemplates, 'Legs'), D)).toBe(false);
    expect(isDeloadDay(program, dayByName(dayTemplates, 'Heavy (planche first)'), D)).toBe(true);
  });
});

describe('acceptance 6: choice slots', () => {
  const { program: base, dayTemplates } = activeProgram(PROGRAM_C);
  const heavyPl = dayByName(dayTemplates, 'Heavy (planche first)');
  const heavyFl = dayByName(dayTemplates, 'Heavy (front lever first)');
  const slotId = slotIdOf(heavyPl);

  it('resolves a slot with no pick to needs pick', () => {
    expect(resolveChoice(base, slotId, 1)).toEqual({ status: 'needs_pick' });
    const snapshot = resolvePlan({ program: base, dayTemplate: heavyPl, date: D, exercisesById });
    expect(snapshot.blocks[3]?.kind).toBe('choice');
  });

  it('applies a pick saved by the test flow in cycle 1 to cycle 2, on both Heavy days', () => {
    const testDay = addDays(D, 40);
    const cycle = resolvePlan({
      program: base,
      dayTemplate: dayByName(dayTemplates, 'Test'),
      date: testDay,
      exercisesById,
    }).cycleNumber;
    expect(cycle).toBe(1);
    const program = saveChoice(base, slotId, testFlowTargetCycle(cycle ?? 0), 1);

    expect(resolveChoice(program, slotId, 1)).toEqual({ status: 'needs_pick' });
    expect(resolveChoice(program, slotId, 2)).toEqual({ status: 'picked', optionIndex: 1 });

    for (const day of [heavyPl, heavyFl]) {
      const snapshot = resolvePlan({
        program,
        dayTemplate: day,
        date: addDays(D, 42),
        exercisesById,
      });
      const block = snapshot.blocks.find((b) => b.kind === 'exercise' && b.fromSlotId === slotId);
      expect(block).toMatchObject({
        kind: 'exercise',
        exerciseId: 'front-lever-raises',
        setsMin: 3,
        optionIndex: 1,
        target: { repsMin: 5, bandIds: [], progressionLevel: 'current' },
      });
    }
  });

  it('falls back to the latest earlier pick and ignores later ones', () => {
    let program: Program = saveChoice(base, slotId, 3, 2);
    program = saveChoice(program, slotId, 7, 0);
    expect(resolveChoice(program, slotId, 5)).toEqual({ status: 'picked', optionIndex: 2 });
    expect(resolveChoice(program, slotId, 2)).toEqual({ status: 'needs_pick' });
    expect(resolveChoice(program, slotId, 9)).toEqual({ status: 'picked', optionIndex: 0 });
  });

  it('replaces a pick for the same cycle', () => {
    const program = saveChoice(saveChoice(base, slotId, 2, 0), slotId, 2, 2);
    expect(program.choiceSelections).toEqual([{ cycleNumber: 2, slotId, optionIndex: 2 }]);
  });

  it('counts a test done before the first week for cycle 1', () => {
    expect(testFlowTargetCycle(0)).toBe(1);
    expect(testFlowTargetCycle(-2)).toBe(1);
    expect(testFlowTargetCycle(1)).toBe(2);
  });

  it('halves a picked option during a deload', () => {
    const program = saveChoice(base, slotId, 1, 0);
    const snapshot = resolvePlan({ program, dayTemplate: heavyPl, date: WEEK_6, exercisesById });
    expect(snapshot.blocks[3]).toMatchObject({ exerciseId: 'planche-lean', setsMin: 2 });
  });
});

describe('plan snapshot', () => {
  it('is a deep copy, so editing the program later leaves it unchanged', () => {
    const { program, dayTemplates } = activeProgram(PROGRAM_C);
    const legs = dayByName(dayTemplates, 'Legs');
    const snapshot = resolvePlan({ program, dayTemplate: legs, date: D, exercisesById });
    const frozen = structuredClone(snapshot);
    const first = legs.blocks[0];
    if (!first) throw new Error('no block');
    first.setsMin = 9;
    first.target.repsMin = 1;
    legs.name = 'Changed';
    expect(snapshot).toEqual(frozen);
    expect(snapshot).toMatchObject({
      name: 'Legs',
      dayTemplateId: legs.id,
      cycleNumber: 1,
      cycleWeek: 1,
    });
  });
});
