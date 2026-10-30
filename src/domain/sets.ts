import type { LoggedSet, Session } from './schemas';

/** Done working sets. Warm-ups and sets not marked done never count in stats. */
export function countsForStats(set: LoggedSet): boolean {
  return set.done && set.kind === 'working';
}

export function finishedSessionsById(sessions: readonly Session[]): Map<string, Session> {
  return new Map(sessions.filter((s) => s.status === 'finished').map((s) => [s.id, s]));
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
