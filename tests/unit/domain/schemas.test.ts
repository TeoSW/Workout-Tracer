import { describe, expect, it } from 'vitest';
import {
  BlockSchema,
  DEFAULT_SETTINGS,
  DateStrSchema,
  LoggedSetSchema,
  ProgramSchema,
  RirSchema,
  validateSetForExercise,
  type Exercise,
  type LoggedSet,
} from '../../../src/domain/schemas';

const baseSet: LoggedSet = {
  id: 's1',
  sessionId: 'sess1',
  sessionExerciseId: 'se1',
  exerciseId: 'pull-ups',
  order: 0,
  kind: 'working',
  rir: null,
  done: false,
  completedAt: null,
};

const pullUps: Exercise = {
  id: 'pull-ups',
  name: 'Pull-ups',
  trackingType: 'bodyweight_reps',
  primaryMuscles: ['lats'],
  secondaryMuscles: ['biceps', 'upper_back'],
  unilateral: false,
  loadUnit: 'total',
  defaultRestSec: 120,
  cues: '',
  alternativeIds: [],
  isCustom: false,
  archived: false,
};

describe('schemas', () => {
  it('accepts RIR from 0 to 5 in steps of 0.5, or null', () => {
    for (const rir of [0, 0.5, 2, 4.5, 5, null])
      expect(RirSchema.safeParse(rir).success).toBe(true);
    for (const rir of [-0.5, 5.5, 1.25, Number.NaN]) {
      expect(RirSchema.safeParse(rir).success).toBe(false);
    }
  });

  it('accepts only real calendar dates', () => {
    expect(DateStrSchema.safeParse('2026-10-26').success).toBe(true);
    expect(DateStrSchema.safeParse('2026-13-01').success).toBe(false);
  });

  it('parses a logged set and rejects a bad RIR', () => {
    expect(LoggedSetSchema.parse({ ...baseSet, reps: 10, rir: 2 })).toMatchObject({ reps: 10 });
    expect(LoggedSetSchema.safeParse({ ...baseSet, rir: 7 }).success).toBe(false);
  });

  it('rejects a block whose setsMax is below setsMin', () => {
    const block = {
      kind: 'exercise',
      id: 'b1',
      order: 0,
      exerciseId: 'pull-ups',
      setsMin: 3,
      setsMax: 2,
      target: {},
      warmupSets: 0,
    };
    expect(BlockSchema.safeParse(block).success).toBe(false);
    expect(BlockSchema.safeParse({ ...block, setsMax: 4 }).success).toBe(true);
  });

  it('parses a choice block', () => {
    const block = {
      kind: 'choice',
      id: 'b4',
      order: 3,
      setsMin: 3,
      target: {},
      warmupSets: 0,
      choiceSlot: {
        id: 'weak-point',
        label: 'Weak-point accessory',
        options: [
          { exerciseId: 'plank', setsMin: 3, target: { secondsMin: 30 }, pickWhen: 'Always' },
        ],
      },
    };
    expect(BlockSchema.parse(block).kind).toBe('choice');
  });

  it('parses a weekday program and a rotation program', () => {
    const common = {
      id: 'p1',
      name: 'P',
      splitType: 'custom',
      deloadWeeks: [],
      anchorDate: null,
      choiceSelections: [],
      manualDeloadWeeks: [],
      note: '',
      active: false,
      archived: false,
    };
    const rest = { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null };
    expect(
      ProgramSchema.safeParse({
        ...common,
        cycleWeeks: 1,
        schedule: { kind: 'weekday', weeks: [{ ...rest, mon: 'd1' }] },
      }).success,
    ).toBe(true);
    expect(
      ProgramSchema.safeParse({
        ...common,
        cycleWeeks: null,
        schedule: { kind: 'rotation', sequence: ['d1', 'd2'], sessionsPerWeek: 3 },
      }).success,
    ).toBe(true);
  });

  it('requires a weekday grid to have one entry per cycle week', () => {
    const rest = { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null };
    const result = ProgramSchema.safeParse({
      id: 'p1',
      name: 'P',
      splitType: 'custom',
      cycleWeeks: 2,
      deloadWeeks: [],
      anchorDate: null,
      choiceSelections: [],
      manualDeloadWeeks: [],
      note: '',
      active: false,
      archived: false,
      schedule: { kind: 'weekday', weeks: [rest] },
    });
    expect(result.success).toBe(false);
  });

  it('has the default settings from the spec', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      effortMode: 'rir',
      sound: true,
      keepAwake: true,
      backupReminderDays: 14,
      muscleReference: { min: 10, max: 20 },
      lastBackupAt: null,
    });
  });

  it('never allows added kg and bands on the same bodyweight set', () => {
    expect(
      validateSetForExercise({ ...baseSet, addedKg: 10, bandIds: ['band-15'] }, pullUps),
    ).toEqual({
      ok: false,
      error: 'Use added weight or bands, not both.',
    });
    expect(validateSetForExercise({ ...baseSet, bandIds: ['band-15'] }, pullUps)).toEqual({
      ok: true,
    });
  });
});
