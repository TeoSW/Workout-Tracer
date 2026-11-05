import { describe, expect, it } from 'vitest';
import { setBodyweight } from '../../../src/data/bodyweight';
import { hasFinishedSession, sessionsInMonth } from '../../../src/data/history';
import { seedIfNeeded } from '../../../src/data/seed';
import {
  addExercise,
  finishSession,
  getSessionView,
  lastSetsByExercise,
  sessionPrs,
  setSessionDuration,
  startEmptySession,
  updateSet,
} from '../../../src/data/sessions';
import { loadExerciseStats, loadStatsData } from '../../../src/data/stats';
import { sessionLog } from '../../../src/domain/exercise-series';
import { testContext } from './helpers';

const DAY = 86_400_000;

async function setup() {
  const ctx = testContext();
  await seedIfNeeded(ctx);
  return ctx;
}

type Ctx = Awaited<ReturnType<typeof setup>>;

/** A finished workout with one set of squats, then one day forward. */
async function logSquat(ctx: Ctx, kg: number, reps = 5) {
  const { session } = await startEmptySession(ctx);
  const entry = await addExercise(ctx, session.id, 'squat');
  const set = entry.sets[0];
  if (!set) throw new Error('No set');
  await updateSet(ctx, set.id, { kg, reps, rir: 0, done: true });
  ctx.clock.advance(3_600_000);
  await finishSession(ctx, session.id);
  ctx.clock.advance(DAY);
  return { sessionId: session.id, setId: set.id };
}

describe('history queries', () => {
  it('lists the finished sessions of a month, and leaves out the active one', async () => {
    const ctx = await setup();
    const { sessionId } = await logSquat(ctx, 20);
    await startEmptySession(ctx);
    const list = await sessionsInMonth(ctx, '2026-11');
    expect(list.map((s) => s.id)).toEqual([sessionId]);
    expect(await sessionsInMonth(ctx, '2026-10')).toEqual([]);
  });

  it('tells whether anything was finished yet', async () => {
    const ctx = await setup();
    expect(await hasFinishedSession(ctx)).toBe(false);
    await logSquat(ctx, 20);
    expect(await hasFinishedSession(ctx)).toBe(true);

    const open = await setup();
    await startEmptySession(open);
    expect(await hasFinishedSession(open)).toBe(false);
  });
});

describe('session duration', () => {
  it('moves the finish time of a finished session', async () => {
    const ctx = await setup();
    const { sessionId } = await logSquat(ctx, 20);
    await setSessionDuration(ctx, sessionId, 45);
    const view = await getSessionView(ctx, sessionId);
    expect((view?.session.finishedAt ?? 0) - (view?.session.startedAt ?? 0)).toBe(45 * 60_000);
  });

  it('refuses a duration under a minute, and an active session', async () => {
    const ctx = await setup();
    const { sessionId } = await logSquat(ctx, 20);
    await expect(setSessionDuration(ctx, sessionId, 0)).rejects.toThrow(
      'A workout lasts at least one minute.',
    );
    await expect(setSessionDuration(ctx, sessionId, 24 * 60 + 1)).rejects.toThrow(
      'A workout lasts at most 24 hours.',
    );
    const { session } = await startEmptySession(ctx);
    await expect(setSessionDuration(ctx, session.id, 30)).rejects.toThrow();
  });

  it('keeps session order when an old workout gets longer', async () => {
    const ctx = await setup();
    const first = await logSquat(ctx, 20);
    const second = await logSquat(ctx, 25);
    await setSessionDuration(ctx, first.sessionId, 24 * 60);
    ctx.clock.advance(DAY);

    const { session } = await startEmptySession(ctx);
    const last = await lastSetsByExercise(ctx, ['squat'], session.id);
    expect(last.get('squat')?.map((s) => s.id)).toEqual([second.setId]);
    expect(await sessionPrs(ctx, second.sessionId)).not.toEqual([]);
  });
});

describe('stats data', () => {
  it('reads finished sessions with their sets, and nothing from the active one', async () => {
    const ctx = await setup();
    const { setId } = await logSquat(ctx, 20);
    const { session } = await startEmptySession(ctx);
    await addExercise(ctx, session.id, 'squat');
    await setBodyweight(ctx, ctx.clock.today(), 70);

    const data = await loadStatsData(ctx);
    expect(data.sessions).toHaveLength(1);
    expect(data.sets.map((s) => s.id)).toEqual([setId]);
    expect(data.exercisesById.get('squat')?.name).toBe('Squat');
    expect(data.bandsById.size).toBeGreaterThan(0);
    expect(data.bodyweight).toHaveLength(1);
    expect(data.program).toBeNull();
    expect(data.settings.muscleReference).toEqual({ min: 10, max: 20 });
  });

  it('reads what one exercise page needs, and pages through its log', async () => {
    const ctx = await setup();
    await logSquat(ctx, 20);
    await logSquat(ctx, 25);
    const stats = await loadExerciseStats(ctx, 'squat');
    expect(stats.sets).toHaveLength(2);
    expect(stats.sessions).toHaveLength(2);
    const log = sessionLog(stats.sessions, stats.sets);
    expect(log.map((e) => e.sets[0]?.kg)).toEqual([25, 20]);
  });

  it('corrects a PR when an old session is edited', async () => {
    const ctx = await setup();
    const first = await logSquat(ctx, 20);
    const second = await logSquat(ctx, 25);
    expect(await sessionPrs(ctx, second.sessionId)).not.toEqual([]);
    await updateSet(ctx, first.setId, { kg: 30 });
    expect(await sessionPrs(ctx, second.sessionId)).toEqual([]);
  });
});
