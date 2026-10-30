import { describe, expect, it } from 'vitest';
import { movingAverage7 } from '../../../src/domain/bodyweight';
import {
  finishedSessionsInWeek,
  plannedSessionsInWeek,
  sessionDurationMs,
  weekStreak,
} from '../../../src/domain/consistency';
import { addDays } from '../../../src/domain/dates';
import { SEED_BANDS } from '../../../src/domain/fixtures/bands';
import { PROGRAM_A, PROGRAM_B, PROGRAM_C } from '../../../src/domain/fixtures/templates';
import { extendRest, restRemainingMs, startRest } from '../../../src/domain/rest';
import {
  bestCleanHoldByLevel,
  bestCleanHoldInSession,
  complexBandSeries,
} from '../../../src/domain/skills';
import { ANCHOR, activeProgram, makeSession, makeSet } from './helpers';

const D = ANCHOR;
const bandsById = new Map(SEED_BANDS.map((b) => [b.id, b]));

describe('consistency', () => {
  it('counts planned sessions per week from the grid or the rotation', () => {
    const c = activeProgram(PROGRAM_C).program;
    expect(plannedSessionsInWeek(c, D)).toBe(5);
    expect(plannedSessionsInWeek(c, addDays(D, 35))).toBe(5);
    expect(plannedSessionsInWeek(activeProgram(PROGRAM_B).program, D)).toBe(4);
    expect(plannedSessionsInWeek(activeProgram(PROGRAM_A).program, D)).toBe(3);
  });

  it('counts finished sessions of a week and program', () => {
    const sessions = [
      makeSession({ date: D, programId: 'p' }),
      makeSession({ date: addDays(D, 6), programId: 'p' }),
      makeSession({ date: addDays(D, 7), programId: 'p' }),
      makeSession({ date: addDays(D, 1), programId: 'other' }),
      makeSession({ date: addDays(D, 2), programId: 'p', status: 'active', finishedAt: null }),
    ];
    expect(finishedSessionsInWeek(sessions, D, 'p')).toBe(2);
    expect(finishedSessionsInWeek(sessions, D)).toBe(3);
  });

  it('counts the week streak back from this week, or from last week if this week is empty', () => {
    const dates = [addDays(D, -14), addDays(D, -7), addDays(D, -5), addDays(D, 1)];
    expect(weekStreak(dates, addDays(D, 3))).toBe(3);
    expect(weekStreak(dates.slice(0, 3), addDays(D, 3))).toBe(2);
    expect(weekStreak(dates.slice(0, 3), addDays(D, 10))).toBe(0);
    expect(weekStreak([], D)).toBe(0);
  });

  it('measures session duration', () => {
    expect(sessionDurationMs(makeSession({ date: D, startedAt: 1000, finishedAt: 61_000 }))).toBe(
      60_000,
    );
    expect(
      sessionDurationMs(makeSession({ date: D, finishedAt: null, status: 'active' })),
    ).toBeNull();
  });
});

describe('bodyweight', () => {
  it('averages the 7 calendar days ending on each entry', () => {
    const entries = [
      { date: '2026-11-08', kg: 41 },
      { date: '2026-11-01', kg: 40 },
      { date: '2026-11-02', kg: 42 },
      { date: '2026-11-10', kg: 43 },
    ];
    expect(movingAverage7(entries)).toEqual([
      { date: '2026-11-01', kg: 40, average: 40 },
      { date: '2026-11-02', kg: 42, average: 41 },
      { date: '2026-11-08', kg: 41, average: 41.5 },
      { date: '2026-11-10', kg: 43, average: 42 },
    ]);
  });
});

describe('skills', () => {
  const a = makeSession({ date: '2026-11-02' });
  const b = makeSession({ date: '2026-11-05' });
  const hold = (
    sessionId: string,
    seconds: number,
    level: string,
    clean: boolean,
    kind: 'working' | 'warmup' = 'working',
  ) =>
    makeSet({
      sessionId,
      exerciseId: 'planche-hold',
      seconds,
      progressionLevel: level,
      clean,
      kind,
    });
  const sets = [
    hold(a.id, 8, 'Tuck', true),
    hold(a.id, 10, 'Tuck', true),
    hold(a.id, 12, 'Tuck', false),
    hold(a.id, 30, 'Tuck', true, 'warmup'),
    hold(b.id, 4, 'Advanced tuck', true),
    hold(b.id, 11, 'Tuck', true),
  ];

  it('tracks the best clean hold per level per session', () => {
    expect(bestCleanHoldByLevel({ sessions: [b, a], sets, exerciseId: 'planche-hold' })).toEqual([
      { sessionId: a.id, date: '2026-11-02', level: 'Tuck', seconds: 10 },
      { sessionId: b.id, date: '2026-11-05', level: 'Advanced tuck', seconds: 4 },
      { sessionId: b.id, date: '2026-11-05', level: 'Tuck', seconds: 11 },
    ]);
  });

  it('prefills the test flow with the best clean hold of a session', () => {
    expect(
      bestCleanHoldInSession(
        sets.filter((s) => s.sessionId === a.id),
        'planche-hold',
      ),
    ).toEqual({
      seconds: 10,
      progressionLevel: 'Tuck',
    });
    expect(bestCleanHoldInSession([], 'planche-hold')).toBeNull();
  });

  it('tracks the band level on complexes with the share of clean sets', () => {
    const complex = (sessionId: string, bandIds: string[], clean: boolean) =>
      makeSet({ sessionId, exerciseId: 'planche-complex', bandIds, clean });
    const series = complexBandSeries({
      sessions: [a, b],
      sets: [
        complex(a.id, ['band-25'], true),
        complex(a.id, ['band-25'], false),
        complex(b.id, ['band-15'], true),
        complex(b.id, ['band-25'], true),
      ],
      exerciseId: 'planche-complex',
      bandsById,
    });
    expect(series).toEqual([
      { sessionId: a.id, date: '2026-11-02', bandLevel: 25, cleanShare: 0.5 },
      { sessionId: b.id, date: '2026-11-05', bandLevel: 15, cleanShare: 1 },
    ]);
  });
});

describe('rest timer', () => {
  it('computes remaining time from endsAt, so sleep does not drift it', () => {
    const timer = startRest('sess', 90, 1_000);
    expect(timer).toEqual({
      id: 'current',
      sessionId: 'sess',
      startedAt: 1_000,
      endsAt: 91_000,
      durationSec: 90,
    });
    expect(restRemainingMs(timer, 31_000)).toBe(60_000);
    expect(restRemainingMs(timer, 500_000)).toBe(0);
    expect(extendRest(timer, 15)).toMatchObject({ endsAt: 106_000, durationSec: 105 });
  });
});

describe('consistency review fixes', () => {
  it('has no planned count for a weekday program that is not activated', () => {
    const { program } = activeProgram(PROGRAM_C, null);
    expect(plannedSessionsInWeek(program, D)).toBeNull();
    expect(plannedSessionsInWeek(activeProgram(PROGRAM_A, null).program, D)).toBe(3);
  });
});
