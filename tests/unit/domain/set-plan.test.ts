import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES } from '../../../src/domain/fixtures/exercises';
import type { ChoiceBlock, DayTemplate, ExerciseBlock } from '../../../src/domain/schemas';
import { buildRowsForBlock } from '../../../src/domain/session-rows';
import { draftFor } from '../../../src/domain/set-draft';
import { targetForSet, updateSetPlan } from '../../../src/domain/set-plan';
import { resolveChoiceBlock } from '../../../src/domain/choice';
import { formatPlanLine } from '../../../src/domain/format';
import { updateBlock } from '../../../src/domain/program-edit';
import { counterIds } from './helpers';

const squat = SEED_EXERCISES.find((e) => e.id === 'squat');
if (!squat) throw new Error('missing squat');

const block: ExerciseBlock = {
  id: 'b1',
  order: 0,
  kind: 'exercise',
  exerciseId: 'squat',
  setsMin: 3,
  warmupSets: 1,
  target: { repsMin: 8, loadMinKg: 40, rir: 2 },
  setTargets: [{ rir: 3, note: 'Easy first set' }, {}, { note: 'Last set, push it' }],
};

const day: DayTemplate = {
  id: 'd1',
  programId: 'p1',
  name: 'Legs',
  dayType: 'hypertrophy',
  deloadExempt: false,
  note: '',
  blocks: [block],
};

describe('per-set plans', () => {
  it("put each set's own effort and note on top of the block's target", () => {
    expect(targetForSet(block, 0)).toMatchObject({ rir: 3, note: 'Easy first set', repsMin: 8 });
    expect(targetForSet(block, 1)).toEqual({ repsMin: 8, loadMinKg: 40, rir: 2 });
    expect(targetForSet(block, 2)).toMatchObject({ rir: 2, note: 'Last set, push it' });
    expect(targetForSet(block, 5)).toEqual(block.target);
  });

  it('give each working set its own target in a workout, and warm-ups no effort', () => {
    const { sets } = buildRowsForBlock({ sessionId: 's', block, order: 0, newId: counterIds() });
    expect(sets.map((s) => [s.kind, s.target?.rir, s.target?.note])).toEqual([
      ['warmup', undefined, undefined],
      ['working', 3, 'Easy first set'],
      ['working', 2, undefined],
      ['working', 2, 'Last set, push it'],
    ]);
  });

  it('prefill the planned effort before last time’s', () => {
    const last = {
      id: 'x',
      sessionId: 'old',
      sessionExerciseId: 'old-se',
      exerciseId: 'squat',
      order: 0,
      kind: 'working' as const,
      reps: 9,
      kg: 45,
      rir: 1,
      done: true,
      completedAt: 0,
    };
    expect(draftFor({ exercise: squat, target: { rir: 3 }, last })).toMatchObject({
      rir: 3,
      reps: 9,
      kg: 45,
    });
    expect(draftFor({ exercise: squat, target: {}, last }).rir).toBe(1);
    // With effort input off, no effort is prefilled, so none is saved without being seen.
    expect(
      draftFor({ exercise: squat, target: { rir: 3 }, last, effortMode: 'off' }).rir,
    ).toBeNull();
  });

  it('show the effort for every set in the plan line, in the chosen mode', () => {
    expect(formatPlanLine(block, squat, new Map(), 'rpe')).toBe('3 x 8 · 40kg · RPE 8');
    expect(formatPlanLine(block, squat, new Map())).toBe('3 x 8 · 40kg');
  });

  it('carry through a resolved choice slot', () => {
    const choice: ChoiceBlock = {
      id: 'c1',
      order: 0,
      kind: 'choice',
      setsMin: 3,
      warmupSets: 0,
      target: { rir: 2 },
      setTargets: [{ note: 'First' }],
      choiceSlot: {
        id: 'slot',
        label: 'Accessory',
        options: [{ exerciseId: 'plank', setsMin: 3, target: { secondsMin: 30 }, pickWhen: '' }],
      },
    };
    expect(resolveChoiceBlock(choice, 0)).toMatchObject({
      target: { secondsMin: 30, rir: 2 },
      setTargets: [{ note: 'First' }],
    });
  });

  it('drop a field when a block edit sets it to undefined', () => {
    const edited = updateBlock(day, 'b1', { setTargets: undefined });
    expect(edited.blocks[0]).not.toHaveProperty('setTargets');
  });

  it('are edited one set at a time, dropping blanks', () => {
    const plain = { ...day, blocks: [{ ...block, setTargets: undefined }] };
    const one = updateSetPlan(plain, 'b1', 2, { rir: 1, note: '  Top set  ' });
    expect(one.blocks[0]?.setTargets).toEqual([{}, {}, { rir: 1, note: 'Top set' }]);
    const cleared = updateSetPlan(one, 'b1', 2, { rir: undefined, note: '' });
    expect(cleared.blocks[0]).not.toHaveProperty('setTargets');
  });
});
