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

/** How long a rest lasted by `nowMs`: up to its end, or less when it was skipped early. */
export function restSpentMs(timer: RestTimer, nowMs: number): number {
  return Math.max(0, Math.min(nowMs, timer.endsAt) - timer.startedAt);
}

/** Computed from `endsAt`, so it stays right after the phone sleeps. */
export function restRemainingMs(timer: RestTimer, nowMs: number): number {
  return Math.max(0, timer.endsAt - nowMs);
}

/** Adds or takes away seconds. Taking away never ends the rest before now. */
export function extendRest(timer: RestTimer, seconds: number, nowMs?: number): RestTimer {
  const endsAt = Math.max(nowMs ?? -Infinity, timer.endsAt + seconds * 1000);
  return {
    ...timer,
    endsAt,
    durationSec: Math.max(0, Math.round((endsAt - timer.startedAt) / 1000)),
  };
}

/** Sets the rest to end `seconds` from now, whatever was left. */
export function setRestRemaining(timer: RestTimer, seconds: number, nowMs: number): RestTimer {
  const endsAt = nowMs + Math.max(0, seconds) * 1000;
  return {
    ...timer,
    endsAt,
    durationSec: Math.max(0, Math.round((endsAt - timer.startedAt) / 1000)),
  };
}
