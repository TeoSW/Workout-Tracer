import { describe, expect, it } from 'vitest';
import { bestE1rmPerSession, epley, setE1rm } from '../../../src/domain/e1rm';
import {
  effortModeFor,
  formatEffort,
  isValidRir,
  isValidRpe,
  rirToRpe,
  rpeToRir,
} from '../../../src/domain/effort';
import { SEED_BANDS } from '../../../src/domain/fixtures/bands';
import { SEED_EXERCISES } from '../../../src/domain/fixtures/exercises';
import { bandLevel, bodyweightOn, effectiveLoad } from '../../../src/domain/load';
import { detectPrs } from '../../../src/domain/prs';
import type { Exercise, LoggedSet } from '../../../src/domain/schemas';
import { averageWeeklySetsPerMuscle, weeklySetsPerMuscle } from '../../../src/domain/volume';
import { makeSession, makeSet } from './helpers';

const exercisesById = new Map(SEED_EXERCISES.map((e) => [e.id, e]));
const bandsById = new Map(SEED_BANDS.map((b) => [b.id, b]));
function exercise(id: string): Exercise {
  const e = exercisesById.get(id);
  if (!e) throw new Error(`No exercise ${id}`);
  return e;
}

describe('acceptance 7: effort', () => {
  it('saves RPE 8.5 as RIR 1.5 and shows RIR 2 as RPE 8', () => {
    expect(rpeToRir(8.5)).toBe(1.5);
    expect(rirToRpe(2)).toBe(8);
    expect(formatEffort(2, 'rpe')).toBe('RPE 8');
    expect(formatEffort(1.5, 'rir')).toBe('RIR 1.5');
  });

  it('covers the edges of both scales', () => {
    expect(rpeToRir(5)).toBe(5);
    expect(rpeToRir(10)).toBe(0);
    expect(formatEffort(5, 'rir')).toBe('RIR 5+');
    expect(formatEffort(null, 'rir')).toBe('');
    expect(formatEffort(2, 'off')).toBe('');
    expect(() => rpeToRir(4.5)).toThrow();
    expect(() => rpeToRir(8.25)).toThrow();
    expect([isValidRir(0), isValidRir(5), isValidRir(5.5), isValidRir(0.3)]).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect([isValidRpe(5), isValidRpe(10), isValidRpe(10.5), isValidRpe(7.7)]).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  it('lets an exercise override the global mode, and turns effort off only for a checklist', () => {
    expect(effortModeFor('rir', exercise('squat'))).toBe('rir');
    expect(effortModeFor('rir', { ...exercise('squat'), effortInput: 'rpe' })).toBe('rpe');
    expect(effortModeFor('rpe', { ...exercise('squat'), effortInput: 'off' })).toBe('off');
    // Holds, complexes and skill attempts take effort too; only a checklist item doesn't.
    expect(effortModeFor('rpe', exercise('planche-hold'))).toBe('rpe');
    expect(effortModeFor('rir', exercise('planche-complex'))).toBe('rir');
    expect(effortModeFor('rir', exercise('540'))).toBe('rir');
    expect(effortModeFor('rir', exercise('warm-up'))).toBe('off');
  });
});

describe('acceptance 8: e1RM', () => {
  it('uses Epley with RIR and drops sets past 15 reps plus RIR', () => {
    expect(epley(25, 10, 2)).toBe(35);
    expect(epley(25, 14, 2)).toBeNull();
    expect(epley(25, 13, 2)).toBe(37.5);
    expect(epley(100, 5, null)).toBe(116.67);
    expect(epley(25, 0, 2)).toBeNull();
  });
});

describe('acceptance 9: effective load and band level', () => {
  const bw = [{ date: '2026-11-01', kg: 40 }];

  it('adds bodyweight to added kg for weighted dips', () => {
    const dips = makeSet({ sessionId: 's', exerciseId: 'weighted-dips', reps: 8, addedKg: 25 });
    expect(effectiveLoad(dips, exercise('weighted-dips'), bw, '2026-11-02')).toEqual({
      kg: 65,
      includesBodyweight: true,
    });
  });

  it('gives banded pull-ups a band level and no effective load', () => {
    const pullUps = makeSet({
      sessionId: 's',
      exerciseId: 'pull-ups',
      reps: 10,
      bandIds: ['band-35', 'band-15'],
    });
    expect(bandLevel(pullUps.bandIds, bandsById)).toBe(50);
    expect(effectiveLoad(pullUps, exercise('pull-ups'), bw, '2026-11-02')).toBeNull();
    expect(setE1rm(pullUps, exercise('pull-ups'), bw, '2026-11-02')).toBeNull();
  });

  it('charts the added kg alone without a bodyweight entry', () => {
    const dips = makeSet({ sessionId: 's', exerciseId: 'weighted-dips', reps: 8, addedKg: 25 });
    expect(effectiveLoad(dips, exercise('weighted-dips'), [], '2026-11-02')).toEqual({
      kg: 25,
      includesBodyweight: false,
    });
  });

  it('uses the latest bodyweight on or before the date', () => {
    const entries = [
      { date: '2026-11-05', kg: 42 },
      { date: '2026-10-20', kg: 39 },
      { date: '2026-11-01', kg: 40 },
    ];
    expect(bodyweightOn(entries, '2026-11-04')).toBe(40);
    expect(bodyweightOn(entries, '2026-11-05')).toBe(42);
    expect(bodyweightOn(entries, '2026-10-01')).toBeNull();
  });

  it('gives no band level for no bands and ignores unknown band ids', () => {
    expect(bandLevel(undefined, bandsById)).toBe(0);
    expect(bandLevel(['band-25', 'gone'], bandsById)).toBe(25);
  });

  it('computes e1RM from the effective load for weighted bodyweight sets', () => {
    const dips = makeSet({
      sessionId: 's',
      exerciseId: 'weighted-dips',
      reps: 8,
      addedKg: 25,
      rir: 2,
    });
    expect(setE1rm(dips, exercise('weighted-dips'), bw, '2026-11-02')).toBe(86.67);
    const hold = makeSet({ sessionId: 's', exerciseId: 'planche-hold', seconds: 8 });
    expect(setE1rm(hold, exercise('planche-hold'), bw, '2026-11-02')).toBeNull();
  });

  it('keeps the best e1RM per finished session', () => {
    const a = makeSession({ date: '2026-11-02' });
    const b = makeSession({ date: '2026-11-04' });
    const active = makeSession({ date: '2026-11-06', status: 'active', finishedAt: null });
    const sets = [
      makeSet({ sessionId: a.id, exerciseId: 'squat', kg: 20, reps: 10, rir: 2 }),
      makeSet({ sessionId: a.id, exerciseId: 'squat', kg: 25, reps: 10, rir: 2 }),
      makeSet({ sessionId: a.id, exerciseId: 'squat', kg: 60, reps: 5, kind: 'warmup' }),
      makeSet({ sessionId: b.id, exerciseId: 'squat', kg: 22.5, reps: 12, rir: 1 }),
      makeSet({ sessionId: active.id, exerciseId: 'squat', kg: 90, reps: 5 }),
    ];
    const best = bestE1rmPerSession({
      sessions: [b, a, active],
      sets,
      exercise: exercise('squat'),
      bodyweight: [],
    });
    expect(best.map((p) => [p.date, p.e1rm])).toEqual([
      ['2026-11-02', 35],
      ['2026-11-04', 32.25],
    ]);
  });
});

describe('acceptance 10: weekly sets per muscle', () => {
  const weekStart = '2026-11-02';

  it('counts 3 working pull-up sets and ignores the warm-up', () => {
    const s = makeSession({ date: '2026-11-04' });
    const sets = [
      makeSet({ sessionId: s.id, exerciseId: 'pull-ups', kind: 'warmup', reps: 5 }),
      ...[0, 1, 2].map(() => makeSet({ sessionId: s.id, exerciseId: 'pull-ups', reps: 10 })),
    ];
    const volume = weeklySetsPerMuscle({ sessions: [s], sets, exercisesById, weekStart });
    expect(volume.lats).toBe(3);
    expect(volume.biceps).toBe(1.5);
    expect(volume.upper_back).toBe(1.5);
    expect(volume.chest).toBe(0);
  });

  it('only counts done sets of finished sessions inside the Monday to Sunday week', () => {
    const sunday = makeSession({ date: '2026-11-08' });
    const nextMonday = makeSession({ date: '2026-11-09' });
    const active = makeSession({ date: '2026-11-03', status: 'active', finishedAt: null });
    const sets = [
      makeSet({ sessionId: sunday.id, exerciseId: 'squat' }),
      makeSet({ sessionId: sunday.id, exerciseId: 'squat', done: false }),
      makeSet({ sessionId: nextMonday.id, exerciseId: 'squat' }),
      makeSet({ sessionId: active.id, exerciseId: 'squat' }),
      makeSet({ sessionId: sunday.id, exerciseId: 'planche-hold', seconds: 8 }),
      makeSet({ sessionId: sunday.id, exerciseId: 'planche-complex' }),
      makeSet({ sessionId: sunday.id, exerciseId: '540', attempts: 6 }),
      makeSet({ sessionId: sunday.id, exerciseId: 'warm-up' }),
    ];
    const volume = weeklySetsPerMuscle({
      sessions: [sunday, nextMonday, active],
      sets,
      exercisesById,
      weekStart,
    });
    expect(volume.quads).toBe(1);
    expect(volume.front_delts).toBe(2);
    expect(volume.chest).toBe(1);
  });

  it('averages over 4 weeks', () => {
    const s = makeSession({ date: '2026-11-25' });
    const sets = [0, 1, 2, 3].map(() => makeSet({ sessionId: s.id, exerciseId: 'squat' }));
    const average = averageWeeklySetsPerMuscle({
      sessions: [s],
      sets,
      exercisesById,
      lastWeekStart: '2026-11-23',
    });
    expect(average.quads).toBe(1);
    expect(average.glutes).toBe(0.5);
  });
});

describe('acceptance 14: PRs', () => {
  const finished = (date: string, sets: (sessionId: string) => LoggedSet[]) => {
    const session = makeSession({ date });
    return { session, sets: sets(session.id) };
  };
  const current = (sets: (sessionId: string) => LoggedSet[]) => {
    const session = makeSession({ date: '2026-11-20', status: 'active', finishedAt: null });
    return { session, sets: sets(session.id) };
  };

  it('flags a set that beats the previous best e1RM', () => {
    const squat = exercise('squat');
    const previous = [
      finished('2026-11-02', (id) => [
        makeSet({ sessionId: id, exerciseId: 'squat', kg: 25, reps: 10, rir: 2 }),
      ]),
    ];
    const now = current((id) => [
      makeSet({ sessionId: id, exerciseId: 'squat', kg: 25, reps: 10, rir: 1 }),
      makeSet({ sessionId: id, exerciseId: 'squat', kg: 25, reps: 11, rir: 2 }),
    ]);
    const prs = detectPrs({ exercise: squat, previous, current: now, bandsById, bodyweight: [] });
    const e1rm = prs.find((p) => p.kind === 'best_e1rm');
    expect(e1rm).toMatchObject({ setId: now.sets[1]?.id, value: 35.83, previous: 35 });
    expect(prs.find((p) => p.kind === 'most_reps')).toMatchObject({
      setId: now.sets[1]?.id,
      value: 11,
    });
    expect(prs.find((p) => p.kind === 'heaviest_load')).toBeUndefined();
  });

  it('flags a clean hold longer than the previous best at the same level', () => {
    const hold = exercise('planche-hold');
    const previous = [
      finished('2026-11-02', (id) => [
        makeSet({
          sessionId: id,
          exerciseId: 'planche-hold',
          seconds: 8,
          progressionLevel: 'Advanced tuck',
          clean: true,
        }),
        makeSet({
          sessionId: id,
          exerciseId: 'planche-hold',
          seconds: 20,
          progressionLevel: 'Tuck',
          clean: true,
        }),
        makeSet({
          sessionId: id,
          exerciseId: 'planche-hold',
          seconds: 12,
          progressionLevel: 'Advanced tuck',
          clean: false,
        }),
      ]),
    ];
    const now = current((id) => [
      makeSet({
        sessionId: id,
        exerciseId: 'planche-hold',
        seconds: 9,
        progressionLevel: 'Advanced tuck',
        clean: true,
      }),
      makeSet({
        sessionId: id,
        exerciseId: 'planche-hold',
        seconds: 15,
        progressionLevel: 'Advanced tuck',
        clean: false,
      }),
      makeSet({
        sessionId: id,
        exerciseId: 'planche-hold',
        seconds: 4,
        progressionLevel: 'Straddle',
        clean: true,
      }),
    ]);
    const prs = detectPrs({ exercise: hold, previous, current: now, bandsById, bodyweight: [] });
    expect(prs).toEqual([
      { kind: 'longest_hold', key: 'Advanced tuck', setId: now.sets[0]?.id, value: 9, previous: 8 },
    ]);
  });

  it('gives no PR for ties, first logs, warm-ups or unfinished history', () => {
    const squat = exercise('squat');
    const abandoned = makeSession({ date: '2026-11-01', status: 'active', finishedAt: null });
    const previous = [
      finished('2026-11-02', (id) => [
        makeSet({ sessionId: id, exerciseId: 'squat', kg: 25, reps: 10 }),
      ]),
      {
        session: abandoned,
        sets: [makeSet({ sessionId: abandoned.id, exerciseId: 'squat', kg: 10, reps: 3 })],
      },
    ];
    const tie = current((id) => [
      makeSet({ sessionId: id, exerciseId: 'squat', kg: 25, reps: 10 }),
      makeSet({ sessionId: id, exerciseId: 'squat', kg: 80, reps: 10, kind: 'warmup' }),
    ]);
    expect(
      detectPrs({ exercise: squat, previous, current: tie, bandsById, bodyweight: [] }),
    ).toEqual([]);
    const first = current((id) => [
      makeSet({ sessionId: id, exerciseId: 'squat', kg: 25, reps: 10 }),
    ]);
    expect(
      detectPrs({ exercise: squat, previous: [], current: first, bandsById, bodyweight: [] }),
    ).toEqual([]);
  });

  it('tracks heaviest load and most reps at a band level', () => {
    const pullUps = exercise('pull-ups');
    const previous = [
      finished('2026-11-02', (id) => [
        makeSet({
          sessionId: id,
          exerciseId: 'pull-ups',
          reps: 9,
          bandIds: ['band-35', 'band-15'],
        }),
      ]),
    ];
    const now = current((id) => [
      makeSet({ sessionId: id, exerciseId: 'pull-ups', reps: 10, bandIds: ['band-35', 'band-15'] }),
      makeSet({ sessionId: id, exerciseId: 'pull-ups', reps: 12, bandIds: ['band-35'] }),
    ]);
    const prs = detectPrs({ exercise: pullUps, previous, current: now, bandsById, bodyweight: [] });
    expect(prs).toEqual([
      { kind: 'most_reps', key: 'band:50', setId: now.sets[0]?.id, value: 10, previous: 9 },
    ]);
  });

  it('tracks the lowest band on a clean complex set that hit every part', () => {
    const complex = exercise('planche-complex');
    const target = {
      parts: [
        { name: 'Hold', unit: 'seconds' as const, target: 3 },
        { name: 'Press', unit: 'reps' as const, target: 3 },
      ],
    };
    const parts = (hold: number, press: number) => [
      { name: 'Hold', unit: 'seconds' as const, value: hold },
      { name: 'Press', unit: 'reps' as const, value: press },
    ];
    const set = (id: string, bands: string[], p: ReturnType<typeof parts>, clean = true) =>
      makeSet({
        sessionId: id,
        exerciseId: 'planche-complex',
        target,
        bandIds: bands,
        parts: p,
        clean,
        progressionLevel: 'Tuck',
      });
    const previous = [finished('2026-11-02', (id) => [set(id, ['band-25'], parts(3, 3))])];
    const now = current((id) => [
      set(id, ['band-15'], parts(3, 2)),
      set(id, ['band-15'], parts(3, 3), false),
      set(id, ['band-15'], parts(4, 3)),
    ]);
    const prs = detectPrs({ exercise: complex, previous, current: now, bandsById, bodyweight: [] });
    expect(prs).toEqual([
      { kind: 'lowest_band', key: 'Tuck', setId: now.sets[2]?.id, value: 15, previous: 25 },
    ]);
  });

  it('tracks most clean attempts in a session', () => {
    const flips = exercise('540');
    const previous = [
      finished('2026-11-02', (id) => [
        makeSet({ sessionId: id, exerciseId: '540', attempts: 6, cleanAttempts: 3 }),
      ]),
    ];
    const now = current((id) => [
      makeSet({ sessionId: id, exerciseId: '540', attempts: 3, cleanAttempts: 2 }),
      makeSet({ sessionId: id, exerciseId: '540', attempts: 3, cleanAttempts: 2 }),
    ]);
    const prs = detectPrs({ exercise: flips, previous, current: now, bandsById, bodyweight: [] });
    expect(prs).toEqual([
      { kind: 'most_clean_attempts', key: '', setId: null, value: 4, previous: 3 },
    ]);
  });
});
