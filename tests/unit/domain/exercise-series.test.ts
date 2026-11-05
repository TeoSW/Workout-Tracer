import { describe, expect, it } from 'vitest';
import { averageDuration, consistencyWeeks } from '../../../src/domain/consistency';
import { dayNumber } from '../../../src/domain/dates';
import { bodyweightChart, exerciseCharts, recentPrs } from '../../../src/domain/exercise-series';
import { SEED_BANDS } from '../../../src/domain/fixtures/bands';
import { SEED_EXERCISES } from '../../../src/domain/fixtures/exercises';
import { PROGRAM_A, PROGRAM_C } from '../../../src/domain/fixtures/templates';
import { formatChartValue, formatRecord } from '../../../src/domain/format';
import { currentRecords, prHistory } from '../../../src/domain/prs';
import type { BodyweightEntry, Exercise, LoggedSet, Session } from '../../../src/domain/schemas';
import { activeProgram, makeSession, makeSet } from './helpers';

const exercisesById = new Map(SEED_EXERCISES.map((e) => [e.id, e]));
const bandsById = new Map(SEED_BANDS.map((b) => [b.id, b]));
function exercise(id: string): Exercise {
  const e = exercisesById.get(id);
  if (!e) throw new Error(`No exercise ${id}`);
  return e;
}

function charts(
  id: string,
  sessions: Session[],
  sets: LoggedSet[],
  bodyweight: BodyweightEntry[] = [],
) {
  return exerciseCharts({ exercise: exercise(id), sessions, sets, bodyweight, bandsById });
}
const titles = (list: ReturnType<typeof charts>) => list.map((c) => c.title);

describe('charts by tracking type', () => {
  it('gives weight exercises an e1RM trend and heaviest load, per session', () => {
    const a = makeSession({ date: '2026-10-05' });
    const b = makeSession({ date: '2026-10-12' });
    const sets = [
      makeSet({ sessionId: a.id, exerciseId: 'squat', kg: 25, reps: 10, rir: 2 }),
      makeSet({ sessionId: a.id, exerciseId: 'squat', kg: 20, reps: 10, rir: 2 }),
      makeSet({ sessionId: b.id, exerciseId: 'squat', kg: 30, reps: 5, rir: 0 }),
    ];
    const [e1rm, load] = charts('squat', [b, a], sets);
    expect(e1rm?.title).toBe('e1RM trend');
    expect(e1rm?.rows).toEqual([
      { day: dayNumber('2026-10-05'), value: 35 },
      { day: dayNumber('2026-10-12'), value: 35 },
    ]);
    expect(load?.title).toBe('Heaviest load');
    expect(load?.rows.map((r) => r.value)).toEqual([25, 30]);
    expect(load?.readout).toBe('Latest 30kg, best 30kg');
  });

  it('leaves out warm-ups and unfinished sessions', () => {
    const done = makeSession({ date: '2026-10-05' });
    const open = makeSession({ date: '2026-10-06', status: 'active', finishedAt: null });
    const sets = [
      makeSet({ sessionId: done.id, exerciseId: 'squat', kg: 20, reps: 10 }),
      makeSet({ sessionId: done.id, exerciseId: 'squat', kg: 90, reps: 5, kind: 'warmup' }),
      makeSet({ sessionId: done.id, exerciseId: 'squat', kg: 95, reps: 5, done: false }),
      makeSet({ sessionId: open.id, exerciseId: 'squat', kg: 99, reps: 5 }),
    ];
    const [, load] = charts('squat', [done, open], sets);
    expect(load?.rows.map((r) => r.value)).toEqual([20]);
  });

  it('keeps per hand loads as logged', () => {
    const a = makeSession({ date: '2026-10-05' });
    const set = makeSet({ sessionId: a.id, exerciseId: 'lateral-raise', kg: 4, reps: 12 });
    const [, load] = charts('lateral-raise', [a], [set]);
    expect(load?.readout).toBe('Latest 4kg/hand, best 4kg/hand');
  });

  it('charts weighted bodyweight sets as effective load', () => {
    const a = makeSession({ date: '2026-10-05' });
    const set = makeSet({ sessionId: a.id, exerciseId: 'weighted-dips', addedKg: 25, reps: 8 });
    const list = charts('weighted-dips', [a], [set], [{ date: '2026-10-01', kg: 40 }]);
    expect(titles(list)).toEqual(['e1RM trend', 'Effective load']);
    expect(list[1]?.rows.map((r) => r.value)).toEqual([65]);
  });

  it('charts the added kg alone without any bodyweight entry', () => {
    const a = makeSession({ date: '2026-10-05' });
    const set = makeSet({ sessionId: a.id, exerciseId: 'weighted-dips', addedKg: 25, reps: 8 });
    const list = charts('weighted-dips', [a], [set]);
    expect(titles(list)).toEqual(['e1RM trend', 'Added kg']);
    expect(list[1]?.rows.map((r) => r.value)).toEqual([25]);
  });

  it('starts effective load at the first known bodyweight, so the line has no false jump', () => {
    const a = makeSession({ date: '2026-10-05' });
    const b = makeSession({ date: '2026-10-12' });
    const sets = [
      makeSet({ sessionId: a.id, exerciseId: 'weighted-dips', addedKg: 25, reps: 8 }),
      makeSet({ sessionId: b.id, exerciseId: 'weighted-dips', addedKg: 25, reps: 8 }),
    ];
    const list = charts('weighted-dips', [a, b], sets, [{ date: '2026-10-10', kg: 40 }]);
    expect(list.find((c) => c.title === 'Effective load')?.rows.map((r) => r.value)).toEqual([65]);
  });

  it('charts banded sets as band level, reversed, and plain sets as reps', () => {
    const a = makeSession({ date: '2026-10-05' });
    const b = makeSession({ date: '2026-10-12' });
    const sets = [
      makeSet({
        sessionId: a.id,
        exerciseId: 'pull-ups',
        bandIds: ['band-35', 'band-15'],
        reps: 8,
      }),
      makeSet({ sessionId: b.id, exerciseId: 'pull-ups', reps: 6 }),
    ];
    const list = charts('pull-ups', [a, b], sets);
    expect(titles(list)).toEqual(['Band level', 'Best reps']);
    expect(list[0]?.reversed).toBe(true);
    expect(list[0]?.rows.map((r) => r.value)).toEqual([50]);
    expect(list[0]?.note).toBe('Lower is harder.');
    expect(list[1]?.rows.map((r) => r.value)).toEqual([6]);
  });

  it('gives holds one series per level, in ladder order, with stable colors', () => {
    const a = makeSession({ date: '2026-10-05' });
    const b = makeSession({ date: '2026-10-12' });
    const set = (sessionId: string, level: string, seconds: number, clean = true) =>
      makeSet({
        sessionId,
        exerciseId: 'planche-hold',
        progressionLevel: level,
        seconds,
        clean,
      });
    const sets = [
      set(a.id, 'Advanced tuck', 8),
      set(a.id, 'Tuck', 15),
      set(a.id, 'Tuck', 30, false),
      set(b.id, 'Advanced tuck', 10),
    ];
    const [chart] = charts('planche-hold', [a, b], sets);
    expect(chart?.series.map((s) => [s.label, s.slot])).toEqual([
      ['Tuck', 1],
      ['Advanced tuck', 2],
    ]);
    const keys = chart?.series.map((s) => s.key) ?? [];
    expect(chart?.rows).toEqual([
      { day: dayNumber('2026-10-05'), [keys[0] as string]: 15, [keys[1] as string]: 8 },
      { day: dayNumber('2026-10-12'), [keys[0] as string]: null, [keys[1] as string]: 10 },
    ]);
    expect(chart?.readout).toBe('Best: Tuck 15s, Advanced tuck 10s');
  });

  it('keeps a level on its ladder color when lower levels were never logged', () => {
    const a = makeSession({ date: '2026-10-05' });
    const set = makeSet({
      sessionId: a.id,
      exerciseId: 'planche-hold',
      progressionLevel: 'Full',
      seconds: 3,
      clean: true,
    });
    const [chart] = charts('planche-hold', [a], [set]);
    expect(chart?.series.map((s) => [s.label, s.slot])).toEqual([['Full', 4]]);
  });

  it('folds levels past eight into Other', () => {
    const custom: Exercise = {
      ...exercise('planche-hold'),
      id: 'custom-hold',
      progressionLadder: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
    };
    const a = makeSession({ date: '2026-10-05' });
    const sets = ['1', '8', '9'].map((level, i) =>
      makeSet({
        sessionId: a.id,
        exerciseId: custom.id,
        progressionLevel: level,
        seconds: 10 + i,
        clean: true,
      }),
    );
    sets.push(makeSet({ sessionId: a.id, exerciseId: custom.id, seconds: 5, clean: true }));
    const [chart] = exerciseCharts({
      exercise: custom,
      sessions: [a],
      sets,
      bodyweight: [],
      bandsById,
    });
    expect(chart?.series.map((s) => [s.label, s.slot])).toEqual([
      ['1', 1],
      ['Other', 8],
    ]);
    expect(chart?.rows[0]?.[chart.series[1]?.key as string]).toBe(12);
  });

  it('names holds logged without a level', () => {
    const a = makeSession({ date: '2026-10-05' });
    const set = makeSet({
      sessionId: a.id,
      exerciseId: 'planche-hold',
      seconds: 5,
      clean: true,
    });
    const [chart] = charts('planche-hold', [a], [set]);
    expect(chart?.series.map((s) => [s.label, s.slot])).toEqual([['No level', 5]]);
  });

  it('gives complexes separate charts for band level and clean share', () => {
    const a = makeSession({ date: '2026-10-05' });
    const sets = [
      makeSet({
        sessionId: a.id,
        exerciseId: 'planche-complex',
        bandIds: ['band-15'],
        clean: true,
      }),
      makeSet({
        sessionId: a.id,
        exerciseId: 'planche-complex',
        bandIds: ['band-15'],
        clean: false,
      }),
    ];
    const [band, share] = charts('planche-complex', [a], sets);
    expect(band?.title).toBe('Band level');
    expect(band?.reversed).toBe(true);
    expect(share?.title).toBe('Clean sets');
    expect(share?.readout).toBe('Latest 50%, best 50%');
  });

  it('charts attempts per session as clean and total lines', () => {
    const a = makeSession({ date: '2026-10-05' });
    const sets = [
      makeSet({ sessionId: a.id, exerciseId: '540', attempts: 3, cleanAttempts: 2 }),
      makeSet({ sessionId: a.id, exerciseId: '540', attempts: 3, cleanAttempts: 2 }),
    ];
    const [chart] = charts('540', [a], sets);
    expect(chart?.title).toBe('Attempts');
    expect(chart?.series.map((s) => s.label)).toEqual(['Clean', 'Total']);
    expect(chart?.rows).toEqual([{ day: dayNumber('2026-10-05'), clean: 4, total: 6 }]);
    expect(chart?.readout).toBe('Latest 4 of 6 clean, best 4');
  });

  it('gives checklists and exercises with no logs no charts', () => {
    const a = makeSession({ date: '2026-10-05' });
    const set = makeSet({ sessionId: a.id, exerciseId: 'warm-up' });
    expect(charts('warm-up', [a], [set])).toEqual([]);
    expect(charts('squat', [a], [])).toEqual([]);
  });

  it('formats values for tooltips', () => {
    expect(formatChartValue(12.5, 'kg', '/side')).toBe('12.5kg/side');
    expect(formatChartValue(8, 'seconds')).toBe('8s');
    expect(formatChartValue(6, 'reps')).toBe('6 reps');
    expect(formatChartValue(0, 'band')).toBe('No band');
    expect(formatChartValue(50, 'band')).toBe('50kg');
    expect(formatChartValue(0.75, 'share')).toBe('75%');
    expect(formatChartValue(4, 'count')).toBe('4');
  });
});

describe('bodyweight chart', () => {
  it('plots raw entries as points under the 7-day average', () => {
    const chart = bodyweightChart([
      { date: '2026-10-05', kg: 70 },
      { date: '2026-10-06', kg: 71 },
    ]);
    expect(chart?.series.map((s) => [s.label, s.dotsOnly])).toEqual([
      ['Weight', true],
      ['7-day average', undefined],
    ]);
    expect(chart?.rows[1]).toEqual({ day: dayNumber('2026-10-06'), kg: 71, average: 70.5 });
    expect(chart?.readout).toBe('Latest 71kg, 7-day average 70.5kg');
    expect(bodyweightChart([])).toBeNull();
  });
});

describe('PR replay', () => {
  const squat = exercise('squat');
  const logged = (date: string, kg: number, reps: number) => {
    const session = makeSession({ date });
    return {
      session,
      sets: [makeSet({ sessionId: session.id, exerciseId: 'squat', kg, reps, rir: 0 })],
    };
  };
  const replay = (entries: ReturnType<typeof logged>[]) =>
    prHistory({ exercise: squat, sessions: entries, bandsById, bodyweight: [] });

  it('gives a first log no PR, and dates each record that follows', () => {
    const entries = [logged('2026-10-05', 20, 5), logged('2026-10-12', 25, 5)];
    const prs = replay(entries);
    expect(prs.map((p) => p.date)).toEqual(['2026-10-12', '2026-10-12']);
    expect(prs.map((p) => p.kind)).toEqual(['heaviest_load', 'best_e1rm']);
    expect(prs[0]?.sessionId).toBe(entries[1]?.session.id);
    expect(prs[0]?.previous).toBe(20);
  });

  it('replays in finish order, whatever order it is given', () => {
    const entries = [logged('2026-10-12', 25, 5), logged('2026-10-05', 20, 5)];
    expect(replay(entries).map((p) => p.date)).toEqual(['2026-10-12', '2026-10-12']);
  });

  it('follows an edit to an old session', () => {
    const entries = [logged('2026-10-05', 20, 5), logged('2026-10-12', 25, 5)];
    const first = entries[0];
    const edited = first && { ...first, sets: first.sets.map((s) => ({ ...s, kg: 30 })) };
    expect(replay([edited as (typeof entries)[0], entries[1] as (typeof entries)[0]])).toEqual([]);
  });

  it('ignores sessions that are not finished', () => {
    const open = logged('2026-10-12', 25, 5);
    open.session.status = 'active';
    open.session.finishedAt = null;
    expect(replay([logged('2026-10-05', 20, 5), open])).toEqual([]);
  });

  it('gives the standing records with the date each was set', () => {
    const entries = [logged('2026-10-05', 30, 3), logged('2026-10-12', 25, 8)];
    const records = currentRecords({
      exercise: squat,
      sessions: entries,
      bandsById,
      bodyweight: [],
    });
    const heaviest = records.find((r) => r.kind === 'heaviest_load');
    expect(heaviest).toMatchObject({ value: 30, date: '2026-10-05' });
    expect(records.filter((r) => r.kind === 'most_reps').map((r) => r.key)).toEqual([
      'kg:25',
      'kg:30',
    ]);
    expect(formatRecord({ kind: 'most_reps', key: 'kg:25', value: 8 })).toBe('8 reps at 25kg');
  });

  it('lists the latest PRs across exercises, newest first', () => {
    const entries = [logged('2026-10-05', 20, 5), logged('2026-10-12', 25, 5)];
    const dips = makeSession({ date: '2026-10-13' });
    const earlier = makeSession({ date: '2026-10-06' });
    const session = (id: string, added: number) =>
      makeSet({ sessionId: id, exerciseId: 'weighted-dips', addedKg: added, reps: 5 });
    const sessions = [...entries.map((e) => e.session), earlier, dips];
    const sets = [...entries.flatMap((e) => e.sets), session(earlier.id, 10), session(dips.id, 20)];
    const prs = recentPrs({ sessions, sets, exercisesById, bandsById, bodyweight: [], limit: 3 });
    expect(prs).toHaveLength(3);
    expect(prs[0]?.date).toBe('2026-10-13');
    expect(prs[0]?.exerciseId).toBe('weighted-dips');
    expect(prs[2]?.date).toBe('2026-10-12');
  });
});

describe('consistency', () => {
  const today = '2026-11-18'; // a Wednesday

  it('starts at the first finished week and caps at eight weeks', () => {
    const { program } = activeProgram(PROGRAM_A, '2026-01-05');
    expect(consistencyWeeks({ sessions: [], program, today })).toEqual([]);

    const recent = consistencyWeeks({
      sessions: [makeSession({ date: '2026-11-03' })],
      program,
      today,
    });
    expect(recent.map((w) => w.weekStart)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);

    const long = consistencyWeeks({
      sessions: [makeSession({ date: '2026-01-07' })],
      program,
      today,
    });
    expect(long).toHaveLength(8);
    expect(long[7]?.weekStart).toBe('2026-11-16');
  });

  it('counts sessions from any program against the plan of the active one', () => {
    const { program } = activeProgram(PROGRAM_C, '2026-10-19');
    const sessions = [
      makeSession({ date: '2026-11-03', programId: 'other' }),
      makeSession({ date: '2026-11-04', programId: program.id }),
    ];
    const [week] = consistencyWeeks({ sessions, program, today });
    expect(week).toMatchObject({ weekStart: '2026-11-02', finished: 2 });
    expect(week?.planned).toBeGreaterThan(2);
  });

  it('shows finished alone without an active program', () => {
    const sessions = [makeSession({ date: '2026-11-03' })];
    expect(consistencyWeeks({ sessions, program: null, today })[0]).toEqual({
      weekStart: '2026-11-02',
      planned: null,
      finished: 1,
    });
  });

  it('averages duration over the last four weeks of finished sessions', () => {
    const start = Date.parse('2026-11-03T10:00:00');
    const sessions = [
      makeSession({ date: '2026-11-03', startedAt: start, finishedAt: start + 30 * 60_000 }),
      makeSession({ date: '2026-11-10', startedAt: start, finishedAt: start + 60 * 60_000 }),
      makeSession({ date: '2026-09-01', startedAt: start, finishedAt: start + 600 * 60_000 }),
      makeSession({ date: '2026-11-11', status: 'active', finishedAt: null }),
    ];
    expect(averageDuration(sessions, today)).toBe(45 * 60_000);
    expect(averageDuration([], today)).toBeNull();
  });
});
