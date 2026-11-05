import { describe, expect, it } from 'vitest';
import { SEED_BANDS } from '../../../src/domain/fixtures/bands';
import { SEED_EXERCISES } from '../../../src/domain/fixtures/exercises';
import { formatLastTime, formatPr, formatSetResult } from '../../../src/domain/format';
import { lastTimeSet } from '../../../src/domain/last-time';
import { restAfterSet } from '../../../src/domain/rest-plan';
import type { Block, Exercise, LoggedSet, SetTarget } from '../../../src/domain/schemas';
import { draftFor, draftProblem, draftToPatch } from '../../../src/domain/set-draft';
import { makeSet } from './helpers';

const exercisesById = new Map(SEED_EXERCISES.map((e) => [e.id, e]));
const bandsById = new Map(SEED_BANDS.map((b) => [b.id, b]));

function exercise(id: string): Exercise {
  const e = exercisesById.get(id);
  if (!e) throw new Error(`No exercise ${id}`);
  return e;
}

const set = (exerciseId: string, values: Partial<LoggedSet> = {}) =>
  makeSet({ sessionId: 's', exerciseId, ...values });

describe('lastTimeSet', () => {
  const first = set('squat', { order: 0, kg: 20, reps: 10 });
  const second = set('squat', { order: 1, kg: 22.5, reps: 9 });
  const warmup = set('squat', { order: 2, kg: 10, reps: 5, kind: 'warmup' });
  const skipped = set('squat', { order: 3, kg: 99, reps: 1, done: false });

  it('uses the same set number first', () => {
    expect(lastTimeSet([first, second], 'working', 2)).toBe(second);
    expect(lastTimeSet([second, first], 'working', 1)).toBe(first);
  });

  it('falls back to the last set of that session', () => {
    expect(lastTimeSet([first, second], 'working', 5)).toBe(second);
  });

  it('keeps warm-ups and working sets apart and ignores sets not done', () => {
    expect(lastTimeSet([warmup, first], 'warmup', 1)).toBe(warmup);
    expect(lastTimeSet([warmup, first], 'working', 1)).toBe(first);
    expect(lastTimeSet([first, skipped], 'working', 2)).toBe(first);
  });

  it('gives null when there is no history', () => {
    expect(lastTimeSet([], 'working', 1)).toBeNull();
  });
});

describe('set drafts', () => {
  const planChest: SetTarget = { repsMin: 8, repsMax: 12, loadMinKg: 4 };

  it('prefills from last time, effort included', () => {
    const last = set('upper-chest', { kg: 5, reps: 11, rir: 1 });
    expect(draftFor({ exercise: exercise('upper-chest'), target: planChest, last })).toMatchObject({
      kg: 5,
      reps: 11,
      rir: 1,
    });
  });

  it('falls back to the lower end of the plan', () => {
    const draft = draftFor({ exercise: exercise('upper-chest'), target: planChest, last: null });
    expect(draft).toMatchObject({ kg: 4, reps: 8, rir: null });
    const range = draftFor({
      exercise: exercise('plank'),
      target: { secondsMin: 30, secondsMax: 45 },
      last: null,
    });
    expect(range.seconds).toBe(30);
  });

  it('turns a weighted draft into a done set', () => {
    const e = exercise('upper-chest');
    const draft = draftFor({ exercise: e, target: planChest, last: null });
    expect(draftToPatch({ ...draft, rir: 2 }, e)).toEqual({ kg: 4, reps: 8, rir: 2, done: true });
  });

  it('keeps bands and added kg apart on bodyweight sets', () => {
    const e = exercise('pull-ups');
    const draft = draftFor({ exercise: e, target: { bandIds: ['band-35'] }, last: null });
    expect(draftToPatch({ ...draft, reps: 8, addedKg: 5 }, e)).toMatchObject({
      reps: 8,
      bandIds: ['band-35'],
      addedKg: undefined,
    });
    expect(draftToPatch({ ...draft, reps: 8, addedKg: 5, bandIds: [] }, e)).toMatchObject({
      addedKg: 5,
      bandIds: undefined,
    });
  });

  it('builds a complex from its parts', () => {
    const e = exercise('planche-complex');
    const target: SetTarget = {
      parts: [
        { name: 'Hold', unit: 'seconds', target: 3 },
        { name: 'Press', unit: 'reps', target: 3 },
      ],
      bandIds: ['band-25'],
      progressionLevel: 'current',
    };
    const draft = draftFor({ exercise: e, target, last: null });
    expect(draft.parts).toEqual([
      { name: 'Hold', unit: 'seconds', value: 3 },
      { name: 'Press', unit: 'reps', value: 3 },
    ]);
    expect(draft.progressionLevel).toBeUndefined();
    expect(draftToPatch({ ...draft, clean: true }, e)).toMatchObject({
      parts: draft.parts,
      bandIds: ['band-25'],
      clean: true,
      rir: null,
    });
  });

  it('keeps complex parts in plan order when last time has other parts', () => {
    const e = exercise('planche-complex');
    const target: SetTarget = { parts: [{ name: 'Press', unit: 'reps', target: 3 }] };
    const last = set('planche-complex', { parts: [{ name: 'Press', unit: 'reps', value: 5 }] });
    expect(draftFor({ exercise: e, target, last }).parts).toEqual([
      { name: 'Press', unit: 'reps', value: 5 },
    ]);
    const changed = set('planche-complex', { parts: [{ name: 'Dip', unit: 'reps', value: 5 }] });
    expect(draftFor({ exercise: e, target, last: changed }).parts).toEqual([
      { name: 'Press', unit: 'reps', value: 3 },
    ]);
  });

  it('counts attempts from zero each time', () => {
    const e = exercise('540');
    const last = set('540', { attempts: 6, cleanAttempts: 4 });
    const draft = draftFor({ exercise: e, target: { attemptsMin: 4 }, last });
    expect(draft).toMatchObject({ attempts: 0, cleanAttempts: 0 });
    expect(draftToPatch({ ...draft, attempts: 5, cleanAttempts: 2 }, e)).toMatchObject({
      attempts: 5,
      cleanAttempts: 2,
      done: true,
    });
  });

  it('says what is missing before a set can be saved', () => {
    const chest = exercise('upper-chest');
    expect(draftProblem(draftFor({ exercise: chest, target: {}, last: null }), chest)).toBe(
      'Enter the reps.',
    );
    const hold = exercise('planche-hold');
    expect(draftProblem(draftFor({ exercise: hold, target: {}, last: null }), hold)).toBe(
      'Enter the seconds.',
    );
    const flips = exercise('540');
    expect(draftProblem(draftFor({ exercise: flips, target: {}, last: null }), flips)).toBe(
      'Log at least one attempt.',
    );
    const warmUp = exercise('warm-up');
    expect(draftProblem(draftFor({ exercise: warmUp, target: {}, last: null }), warmUp)).toBeNull();
  });
});

describe('restAfterSet', () => {
  const block = (id: string, exerciseId: string, extra: Partial<Block> = {}): Block =>
    ({
      kind: 'exercise',
      id,
      order: 0,
      exerciseId,
      setsMin: 3,
      target: {},
      warmupSets: 0,
      ...extra,
    }) as Block;
  const se = (id: string, exerciseId: string, order: number, blockId: string | null) => ({
    id,
    exerciseId,
    order,
    blockId,
  });

  it('uses the block rest over the exercise default', () => {
    const blocks = [block('b1', 'squat', { restSec: 45 })];
    const ses = [se('a', 'squat', 0, 'b1')];
    expect(
      restAfterSet({ blocks, sessionExercises: ses, sessionExerciseId: 'a', exercisesById }),
    ).toBe(45);
  });

  it('uses the exercise default without a block, and has no rest for zero', () => {
    const ses = [se('a', 'squat', 0, null), se('w', 'warm-up', 1, null)];
    expect(
      restAfterSet({ blocks: [], sessionExercises: ses, sessionExerciseId: 'a', exercisesById }),
    ).toBe(120);
    expect(
      restAfterSet({ blocks: [], sessionExercises: ses, sessionExerciseId: 'w', exercisesById }),
    ).toBeNull();
  });

  it('rests only after the last exercise of a superset round', () => {
    const blocks = [
      block('b1', 'squat', { supersetGroup: 'g', restSec: 30 }),
      block('b2', 'bicep-curl', { supersetGroup: 'g', restSec: 60 }),
    ];
    const ses = [se('a', 'squat', 0, 'b1'), se('b', 'bicep-curl', 1, 'b2')];
    const input = { blocks, sessionExercises: ses, exercisesById };
    expect(restAfterSet({ ...input, sessionExerciseId: 'a' })).toBeNull();
    expect(restAfterSet({ ...input, sessionExerciseId: 'b' })).toBe(60);
  });

  it('follows the session order when a superset was reordered', () => {
    const blocks = [
      block('b1', 'squat', { supersetGroup: 'g' }),
      block('b2', 'bicep-curl', { supersetGroup: 'g' }),
    ];
    const ses = [se('a', 'squat', 5, 'b1'), se('b', 'bicep-curl', 1, 'b2')];
    const input = { blocks, sessionExercises: ses, exercisesById };
    expect(restAfterSet({ ...input, sessionExerciseId: 'b' })).toBeNull();
    expect(restAfterSet({ ...input, sessionExerciseId: 'a' })).toBe(120);
  });
});

describe('result formats', () => {
  const show = (id: string, values: Partial<LoggedSet>, mode: 'rir' | 'rpe' | 'off' = 'rir') =>
    formatSetResult(set(id, values), exercise(id), mode, bandsById);

  it('reads like the spec for each tracking type', () => {
    expect(show('mid-back-row', { kg: 25, reps: 10, rir: 2 })).toBe('25kg x 10 · RIR 2');
    expect(show('upper-chest', { kg: 4, reps: 10, rir: null })).toBe('4kg/hand x 10');
    expect(show('weighted-dips', { addedKg: 25, reps: 8, rir: 1 }, 'rpe')).toBe(
      '+25kg x 8 · RPE 9',
    );
    expect(show('pull-ups', { bandIds: ['band-35', 'band-15'], reps: 10, rir: 2 })).toBe(
      '35+15 x 10 · RIR 2',
    );
    expect(show('push-ups-incline', { reps: 10, rir: 2 }, 'off')).toBe('10 reps');
    expect(
      show('planche-hold', { seconds: 8, progressionLevel: 'Advanced tuck', clean: true }),
    ).toBe('Advanced tuck · 8s · clean');
    expect(show('planche-hold', { seconds: 8, clean: false })).toBe('8s');
    expect(
      show('planche-complex', {
        parts: [
          { name: 'Hold', unit: 'seconds', value: 3 },
          { name: 'Press', unit: 'reps', value: 3 },
        ],
        bandIds: ['band-25'],
        clean: true,
      }),
    ).toBe('hold 3s, press 3 · band 25kg · clean');
    expect(show('540', { attempts: 6, cleanAttempts: 4 })).toBe('4 of 6 clean');
    expect(show('warm-up', {})).toBe('Done');
  });

  it('writes last time without the effort', () => {
    const last = set('pull-ups', { bandIds: ['band-35', 'band-15'], reps: 9, rir: 1 });
    expect(formatLastTime(last, exercise('pull-ups'), bandsById)).toBe('last: 35+15 x 9');
  });

  it('writes PR lines', () => {
    const pr = { setId: 's', previous: 1 };
    const squat = exercise('squat');
    expect(formatPr({ ...pr, kind: 'best_e1rm', key: '', value: 35.83 }, squat)).toBe(
      'Squat: best e1RM trend 35.83kg',
    );
    expect(formatPr({ ...pr, kind: 'heaviest_load', key: '', value: 30 }, squat)).toBe(
      'Squat: heaviest load 30kg',
    );
    expect(formatPr({ ...pr, kind: 'most_reps', key: 'kg:25', value: 11 }, squat)).toBe(
      'Squat: 11 reps at 25kg',
    );
    const pulls = exercise('pull-ups');
    expect(formatPr({ ...pr, kind: 'most_reps', key: 'band:50', value: 11 }, pulls)).toBe(
      'Pull-ups: 11 reps at band 50kg',
    );
    expect(formatPr({ ...pr, kind: 'most_reps', key: 'added:20', value: 6 }, pulls)).toBe(
      'Pull-ups: 6 reps at +20kg',
    );
    expect(formatPr({ ...pr, kind: 'most_reps', key: 'bodyweight', value: 6 }, pulls)).toBe(
      'Pull-ups: 6 reps at bodyweight',
    );
    expect(
      formatPr({ ...pr, kind: 'longest_hold', key: 'Tuck', value: 9 }, exercise('planche-hold')),
    ).toBe('Planche Hold: longest clean hold 9s at Tuck');
    expect(
      formatPr({ ...pr, kind: 'lowest_band', key: 'Tuck', value: 15 }, exercise('planche-complex')),
    ).toBe('Planche Complex: lowest band 15kg at Tuck');
    expect(
      formatPr({ ...pr, kind: 'most_clean_attempts', key: '', value: 4 }, exercise('540')),
    ).toBe('540: 4 clean attempts');
  });
});
