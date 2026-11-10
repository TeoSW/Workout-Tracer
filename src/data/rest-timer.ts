import { extendRest, setRestRemaining, startRest } from '../domain/rest';
import type { RestTimer } from '../domain/schemas';
import type { DataContext } from './context';

const TIMER_ID = 'current';

/** One timer at a time. Stored as an end time so it is still right after a reload or sleep. */
export async function startRestTimer(
  ctx: DataContext,
  sessionId: string,
  durationSec: number,
): Promise<RestTimer> {
  const timer = startRest(sessionId, durationSec, ctx.clock.now());
  await ctx.db.restTimer.put(timer);
  return timer;
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
  await ctx.db.restTimer.delete(TIMER_ID);
}
