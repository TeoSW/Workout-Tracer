import { extendRest, restSpentMs, setRestRemaining, startRest } from '../domain/rest';
import type { RestTimer } from '../domain/schemas';
import type { DataContext } from './context';

const TIMER_ID = 'current';

/** One timer at a time. Stored as an end time so it is still right after a reload or sleep. */
export async function startRestTimer(
  ctx: DataContext,
  sessionId: string,
  durationSec: number,
): Promise<RestTimer> {
  return ctx.db.transaction('rw', [ctx.db.restTimer, ctx.db.sessions], async () => {
    // A rest cut short by the next set still counts for the time it ran.
    const previous = await ctx.db.restTimer.get(TIMER_ID);
    if (previous) await accrueRest(ctx, previous);
    const timer = startRest(sessionId, durationSec, ctx.clock.now());
    await ctx.db.restTimer.put(timer);
    return timer;
  });
}

/**
 * Adds the time a rest ran to its workout. `untilNow` is for Skip and Dismiss: the user says the
 * rest ended now, even past the timer. When the next set's rest replaces it, it counts up to its
 * end, since the time after that went into the set.
 */
export async function accrueRest(
  ctx: DataContext,
  timer: RestTimer,
  untilNow = false,
): Promise<void> {
  const session = await ctx.db.sessions.get(timer.sessionId);
  if (!session) return;
  const now = ctx.clock.now();
  const spent = untilNow ? Math.max(0, now - timer.startedAt) : restSpentMs(timer, now);
  await ctx.db.sessions.put({ ...session, restMs: (session.restMs ?? 0) + spent });
}

export async function getRestTimer(ctx: DataContext): Promise<RestTimer | undefined> {
  return ctx.db.restTimer.get(TIMER_ID);
}

export async function extendRestTimer(ctx: DataContext, seconds: number): Promise<RestTimer> {
  return ctx.db.transaction('rw', ctx.db.restTimer, async () => {
    const timer = await ctx.db.restTimer.get(TIMER_ID);
    if (!timer) throw new Error('No rest timer is running.');
    const extended = extendRest(timer, seconds, ctx.clock.now());
    await ctx.db.restTimer.put(extended);
    return extended;
  });
}

/** Restarts the running rest from now with a time the user picked. */
export async function setRestTimerRemaining(ctx: DataContext, seconds: number): Promise<RestTimer> {
  return ctx.db.transaction('rw', ctx.db.restTimer, async () => {
    const timer = await ctx.db.restTimer.get(TIMER_ID);
    if (!timer) throw new Error('No rest timer is running.');
    const changed = setRestRemaining(timer, seconds, ctx.clock.now());
    await ctx.db.restTimer.put(changed);
    return changed;
  });
}

export async function skipRestTimer(ctx: DataContext): Promise<void> {
  await ctx.db.transaction('rw', [ctx.db.restTimer, ctx.db.sessions], async () => {
    const timer = await ctx.db.restTimer.get(TIMER_ID);
    if (timer) await accrueRest(ctx, timer, true);
    await ctx.db.restTimer.delete(TIMER_ID);
  });
}
