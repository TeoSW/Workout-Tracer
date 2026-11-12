import { describe, expect, it } from 'vitest';
import { sessionTimes } from '../../../src/domain/consistency';
import { SEED_BANDS } from '../../../src/domain/fixtures/bands';
import { SEED_EXERCISES } from '../../../src/domain/fixtures/exercises';
import { restSpentMs } from '../../../src/domain/rest';
import {
  bandUsage,
  setVolumeKg,
  volumeChart,
  weeklyCharts,
  weeklyStats,
} from '../../../src/domain/weekly-stats';
import { makeSession, makeSet } from './helpers';

const exercises = new Map(SEED_EXERCISES.map((e) => [e.id, e]));
const bands = new Map(SEED_BANDS.map((b) => [b.id, b]));
const ex = (id: string) => {
  const e = exercises.get(id);
  if (!e) throw new Error(id);
  return e;
};

describe('volume', () => {
  it('counts kg x reps, both hands for per-hand loads, and bodyweight on bodyweight exercises', () => {
    const date = '2026-11-02';
    expect(
      setVolumeKg(
        makeSet({ sessionId: 's', exerciseId: 'squat', kg: 60, reps: 5 }),
        ex('squat'),
        [],
        date,
      ),
    ).toBe(300);
    expect(
      setVolumeKg(
        makeSet({ sessionId: 's', exerciseId: 'bicep-curl', kg: 10, reps: 10 }),
        ex('bicep-curl'),
        [],
        date,
      ),
    ).toBe(200);
    const bw = [{ date: '2026-11-01', kg: 70 }];
    expect(
      setVolumeKg(
        makeSet({ sessionId: 's', exerciseId: 'weighted-dips', addedKg: 20, reps: 8 }),
        ex('weighted-dips'),
        bw,
        date,
      ),
    ).toBe(720);
    expect(
      setVolumeKg(
        makeSet({ sessionId: 's', exerciseId: 'plank', seconds: 60 }),
        ex('plank'),
        [],
        date,
      ),
    ).toBe(0);
  });
});

describe('weekly statistics', () => {
  const lastWeek = makeSession({ date: '2026-11-04', restMs: 20 * 60_000 });
  const thisWeek = makeSession({ date: '2026-11-10', restMs: 15 * 60_000 });
  const sets = [
    makeSet({ sessionId: lastWeek.id, exerciseId: 'squat', kg: 50, reps: 10 }),
    makeSet({ sessionId: thisWeek.id, exerciseId: 'squat', kg: 60, reps: 10 }),
    makeSet({ sessionId: thisWeek.id, exerciseId: 'squat', kg: 60, reps: 10, kind: 'warmup' }),
  ];
  const input = {
    sessions: [lastWeek, thisWeek],
    sets,
    exercisesById: exercises,
    bodyweight: [],
    today: '2026-11-12',
    weeks: 4,
  };

  it('add up volume, working sets, reps and minutes per week, leaving out warm-ups', () => {
    const weeks = weeklyStats(input);
    expect(weeks.map((w) => w.weekStart)).toEqual([
      '2026-10-19',
      '2026-10-26',
      '2026-11-02',
      '2026-11-09',
    ]);
    expect(weeks[3]).toMatchObject({
      volumeKg: 600,
      sets: 1,
      reps: 10,
      totalMinutes: 60,
      workingMinutes: 45,
    });
    expect(weeks[2]).toMatchObject({ volumeKg: 500, workingMinutes: 40 });
  });

  it('say how this week compares with last week', () => {
    const [volume, setsReps, time] = weeklyCharts(input);
    expect(volume?.readout).toMatch(/^This week 600kg, last week 500kg \(\+20%\)/);
    expect(setsReps?.readout).toBe('This week 1 set and 10 reps, last week 1 set and 10 reps');
    expect(time?.readout).toBe('This week 1h 00m in total, 45m working, about 1h 00m per workout');
  });
});

describe('averages', () => {
  it('leave out the weeks before the first workout, and divide time by workouts', () => {
    const one = makeSession({ date: '2026-11-03', restMs: 0 });
    one.finishedAt = one.startedAt + 30 * 60_000;
    const busy = [10, 11, 12, 13].map((d) => {
      const s = makeSession({ date: `2026-11-${d}`, restMs: 0 });
      s.finishedAt = s.startedAt + 90 * 60_000;
      return s;
    });
    const sets = [
      makeSet({ sessionId: one.id, exerciseId: 'squat', kg: 100, reps: 10 }),
      ...busy.map((s) => makeSet({ sessionId: s.id, exerciseId: 'squat', kg: 100, reps: 10 })),
    ];
    const charts = weeklyCharts({
      sessions: [one, ...busy],
      sets,
      exercisesById: exercises,
      bodyweight: [],
      today: '2026-11-13',
      weeks: 8,
    });
    // Only one full week before this one: its 1,000kg, not 1,000 spread over 4 weeks.
    expect(charts[0]?.readout).toMatch(/4-week average 1000kg$/);
    // 30 + 4 x 90 = 390 minutes over 5 workouts.
    expect(charts[2]?.readout).toMatch(/about 1h 18m per workout$/);
  });
});

describe('time and rest', () => {
  it('split a workout into rest and working time', () => {
    const s = makeSession({ date: '2026-11-10', restMs: 25 * 60_000 });
    expect(sessionTimes(s)).toEqual({
      totalMs: 3_600_000,
      restMs: 1_500_000,
      workingMs: 2_100_000,
    });
    expect(sessionTimes(makeSession({ date: '2026-11-10' }))).toBeNull();
  });

  it('count a rest only up to now when it is skipped early', () => {
    const timer = {
      id: 'current' as const,
      sessionId: 's',
      startedAt: 0,
      endsAt: 90_000,
      durationSec: 90,
    };
    expect(restSpentMs(timer, 30_000)).toBe(30_000);
    expect(restSpentMs(timer, 200_000)).toBe(90_000);
  });
});

describe('per exercise', () => {
  it('chart the volume of each workout', () => {
    const a = makeSession({ date: '2026-11-03' });
    const b = makeSession({ date: '2026-11-05' });
    const chart = volumeChart({
      exercise: ex('squat'),
      sessions: [a, b],
      sets: [
        makeSet({ sessionId: a.id, exerciseId: 'squat', kg: 50, reps: 5 }),
        makeSet({ sessionId: b.id, exerciseId: 'squat', kg: 60, reps: 5 }),
      ],
      bodyweight: [],
    });
    expect(chart?.readout).toBe('Latest 300kg, best 300kg');
    expect(chart?.rows).toHaveLength(2);
  });

  it('count sets per band and say since when the thinnest band is used', () => {
    const a = makeSession({ date: '2026-11-03' });
    const b = makeSession({ date: '2026-11-10' });
    const usage = bandUsage({
      exercise: ex('pull-ups'),
      sessions: [a, b],
      sets: [
        makeSet({ sessionId: a.id, exerciseId: 'pull-ups', reps: 8, bandIds: ['band-35'] }),
        makeSet({ sessionId: a.id, exerciseId: 'pull-ups', reps: 8, bandIds: ['band-35'] }),
        makeSet({ sessionId: b.id, exerciseId: 'pull-ups', reps: 6, bandIds: ['band-25'] }),
      ],
      bandsById: bands,
    });
    expect(usage?.readout).toBe(
      'By band: 35kg 2 sets, 25kg 1 set. Thinnest so far, 25kg, since 10 Nov',
    );
  });
});
