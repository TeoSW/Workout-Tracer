import type { RestTimer } from './schemas';

export function startRest(sessionId: string, durationSec: number, nowMs: number): RestTimer {
  return {
    id: 'current',
    sessionId,
    startedAt: nowMs,
    endsAt: nowMs + durationSec * 1000,
    durationSec,
  };
}

/** Computed from `endsAt`, so it stays right after the phone sleeps. */
export function restRemainingMs(timer: RestTimer, nowMs: number): number {
  return Math.max(0, timer.endsAt - nowMs);
}

export function extendRest(timer: RestTimer, seconds: number): RestTimer {
  return {
    ...timer,
    endsAt: timer.endsAt + seconds * 1000,
    durationSec: timer.durationSec + seconds,
  };
}
