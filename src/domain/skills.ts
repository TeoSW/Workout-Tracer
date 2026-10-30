import type { DateStr } from './dates';
import { bandLevel } from './load';
import type { Band, LoggedSet, Session } from './schemas';
import { countsForStats, finishedSessionsById } from './sets';

type SeriesInput = { sessions: readonly Session[]; sets: readonly LoggedSet[]; exerciseId: string };

function setsBySession(input: SeriesInput): { session: Session; sets: LoggedSet[] }[] {
  const sessions = finishedSessionsById(input.sessions);
  const grouped = new Map<string, LoggedSet[]>();
  for (const set of input.sets) {
    if (
      set.exerciseId !== input.exerciseId ||
      !countsForStats(set) ||
      !sessions.has(set.sessionId)
    ) {
      continue;
    }
    grouped.set(set.sessionId, [...(grouped.get(set.sessionId) ?? []), set]);
  }
  return [...grouped.entries()]
    .map(([id, sets]) => ({ session: sessions.get(id) as Session, sets }))
    .sort((a, b) => a.session.date.localeCompare(b.session.date));
}

export type HoldPoint = { sessionId: string; date: DateStr; level: string; seconds: number };

/** The best clean hold per progression level in each finished session, oldest first. */
export function bestCleanHoldByLevel(input: SeriesInput): HoldPoint[] {
  return setsBySession(input).flatMap(({ session, sets }) => {
    const best = new Map<string, number>();
    for (const set of sets) {
      if (set.clean !== true || set.seconds === undefined) continue;
      const level = set.progressionLevel ?? '';
      best.set(level, Math.max(best.get(level) ?? 0, set.seconds));
    }
    return [...best.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([level, seconds]) => ({ sessionId: session.id, date: session.date, level, seconds }));
  });
}

/** Prefill for the test flow: the longest clean hold in a session's sets. */
export function bestCleanHoldInSession(
  sets: readonly LoggedSet[],
  exerciseId: string,
): { seconds: number; progressionLevel: string | null } | null {
  let best: LoggedSet | null = null;
  for (const set of sets) {
    if (set.exerciseId !== exerciseId || set.clean !== true || set.seconds === undefined) continue;
    if (!countsForStats(set)) continue;
    if (best === null || set.seconds > (best.seconds ?? 0)) best = set;
  }
  return best === null
    ? null
    : { seconds: best.seconds ?? 0, progressionLevel: best.progressionLevel ?? null };
}

export type ComplexBandPoint = {
  sessionId: string;
  date: DateStr;
  /** The lowest (hardest) band level used in the session. */
  bandLevel: number;
  cleanShare: number;
};

export function complexBandSeries(
  input: SeriesInput & { bandsById: ReadonlyMap<string, Band> },
): ComplexBandPoint[] {
  return setsBySession(input).map(({ session, sets }) => ({
    sessionId: session.id,
    date: session.date,
    bandLevel: Math.min(...sets.map((s) => bandLevel(s.bandIds, input.bandsById))),
    cleanShare: sets.filter((s) => s.clean === true).length / sets.length,
  }));
}
