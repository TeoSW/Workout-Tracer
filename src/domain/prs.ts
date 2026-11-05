import type { DateStr } from './dates';
import { setE1rm } from './e1rm';
import { bandLevel } from './load';
import type { Band, BodyweightEntry, Exercise, LoggedSet, Session } from './schemas';
import { countsForStats } from './sets';

export type PrKind =
  | 'heaviest_load'
  | 'best_e1rm'
  | 'most_reps'
  | 'longest_hold'
  | 'lowest_band'
  | 'most_clean_attempts';

export type PrFlag = {
  kind: PrKind;
  /** What the record is grouped by: a load, a band level or a progression level. Empty when not grouped. */
  key: string;
  /** The set that set the record. Null for per-session records. */
  setId: string | null;
  value: number;
  previous: number;
};

export type SessionSets = { session: Session; sets: LoggedSet[] };
export type DatedPr = PrFlag & { sessionId: string; date: DateStr };
export type ExerciseRecord = Omit<PrFlag, 'previous'> & { sessionId: string; date: DateStr };

type Candidate = { kind: PrKind; key: string; setId: string | null; value: number };
type Ctx = {
  exercise: Exercise;
  bandsById: ReadonlyMap<string, Band>;
  bodyweight: readonly BodyweightEntry[];
};

const LOWER_IS_BETTER: ReadonlySet<PrKind> = new Set(['lowest_band']);
const KIND_ORDER: PrKind[] = [
  'heaviest_load',
  'best_e1rm',
  'most_reps',
  'longest_hold',
  'lowest_band',
  'most_clean_attempts',
];

function repsKey(set: LoggedSet, ctx: Ctx): string {
  if (ctx.exercise.trackingType === 'weight_reps') return `kg:${set.kg ?? 0}`;
  if ((set.bandIds?.length ?? 0) > 0) return `band:${bandLevel(set.bandIds, ctx.bandsById)}`;
  if ((set.addedKg ?? 0) > 0) return `added:${set.addedKg}`;
  return 'bodyweight';
}

function hitEveryPart(set: LoggedSet): boolean {
  const targets = set.target?.parts ?? [];
  if (targets.length === 0 || !set.parts) return false;
  return targets.every((t) => {
    const logged = set.parts?.find((p) => p.name === t.name);
    return logged !== undefined && logged.value >= t.target;
  });
}

function candidates(entry: SessionSets, ctx: Ctx): Candidate[] {
  const { exercise } = ctx;
  const sets = entry.sets.filter((s) => s.exerciseId === exercise.id && countsForStats(s));
  const out: Candidate[] = [];
  let cleanAttempts: number | null = null;

  for (const set of sets) {
    switch (exercise.trackingType) {
      case 'weight_reps':
      case 'bodyweight_reps': {
        const heaviest = exercise.trackingType === 'weight_reps' ? set.kg : set.addedKg;
        if (heaviest !== undefined && heaviest > 0) {
          out.push({ kind: 'heaviest_load', key: '', setId: set.id, value: heaviest });
        }
        const e1rm = setE1rm(set, exercise, ctx.bodyweight, entry.session.date);
        if (e1rm !== null) out.push({ kind: 'best_e1rm', key: '', setId: set.id, value: e1rm });
        if (set.reps !== undefined && set.reps > 0) {
          if (exercise.trackingType === 'bodyweight_reps' || set.kg !== undefined) {
            out.push({ kind: 'most_reps', key: repsKey(set, ctx), setId: set.id, value: set.reps });
          }
        }
        break;
      }
      case 'hold':
        if (set.clean === true && set.seconds !== undefined && set.seconds > 0) {
          const key = set.progressionLevel ?? '';
          out.push({ kind: 'longest_hold', key, setId: set.id, value: set.seconds });
        }
        break;
      case 'complex':
        if (set.clean === true && hitEveryPart(set)) {
          const key = set.progressionLevel ?? '';
          out.push({
            kind: 'lowest_band',
            key,
            setId: set.id,
            value: bandLevel(set.bandIds, ctx.bandsById),
          });
        }
        break;
      case 'attempts':
        if (set.cleanAttempts !== undefined)
          cleanAttempts = (cleanAttempts ?? 0) + set.cleanAttempts;
        break;
      case 'checklist':
        break;
    }
  }
  if (cleanAttempts !== null) {
    out.push({ kind: 'most_clean_attempts', key: '', setId: null, value: cleanAttempts });
  }
  return out;
}

const better = (kind: PrKind, a: number, b: number) => (LOWER_IS_BETTER.has(kind) ? a < b : a > b);

function bestByKey(list: Candidate[]): Map<string, Candidate> {
  const best = new Map<string, Candidate>();
  for (const c of list) {
    const id = `${c.kind}|${c.key}`;
    const current = best.get(id);
    if (!current || better(c.kind, c.value, current.value)) best.set(id, c);
  }
  return best;
}

/** What `now` beats in `history`. A record needs a previous value, and a tie is not a PR. */
function beaten(now: Map<string, Candidate>, history: Map<string, Candidate>): PrFlag[] {
  const flags: PrFlag[] = [];
  for (const [id, c] of now) {
    const previous = history.get(id);
    if (previous && better(c.kind, c.value, previous.value)) {
      flags.push({
        kind: c.kind,
        key: c.key,
        setId: c.setId,
        value: c.value,
        previous: previous.value,
      });
    }
  }
  return flags.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
}

/**
 * PRs set by the current session for one exercise. History is limited to finished sessions, and
 * only done working sets count, so a first log gives no PR.
 */
export function detectPrs(input: {
  exercise: Exercise;
  previous: readonly SessionSets[];
  current: SessionSets;
  bandsById: ReadonlyMap<string, Band>;
  bodyweight: readonly BodyweightEntry[];
}): PrFlag[] {
  const ctx: Ctx = input;
  const history = bestByKey(
    input.previous
      .filter((e) => e.session.status === 'finished' && e.session.id !== input.current.session.id)
      .flatMap((e) => candidates(e, ctx)),
  );
  return beaten(bestByKey(candidates(input.current, ctx)), history);
}

type ReplayInput = Ctx & { sessions: readonly SessionSets[] };
type Dated = Candidate & { sessionId: string; date: DateStr };

/**
 * Walks an exercise's finished sessions in finish order, keeping the best so far. Nothing is
 * stored, so editing an old session corrects every record after it.
 */
function replay(input: ReplayInput): { prs: DatedPr[]; best: Map<string, Dated> } {
  const ordered = input.sessions
    .filter((e) => e.session.status === 'finished')
    .sort((a, b) => (a.session.finishedAt ?? 0) - (b.session.finishedAt ?? 0));
  const best = new Map<string, Dated>();
  const prs: DatedPr[] = [];
  for (const entry of ordered) {
    const { id: sessionId, date } = entry.session;
    const now = bestByKey(candidates(entry, input));
    for (const flag of beaten(now, best)) prs.push({ ...flag, sessionId, date });
    for (const [id, c] of now) {
      const current = best.get(id);
      if (!current || better(c.kind, c.value, current.value)) {
        best.set(id, { ...c, sessionId, date });
      }
    }
  }
  return { prs, best };
}

/** Every PR an exercise has had, oldest first. */
export function prHistory(input: ReplayInput): DatedPr[] {
  return replay(input).prs;
}

/** The standing records of an exercise, with the session that set each one. */
export function currentRecords(input: ReplayInput): ExerciseRecord[] {
  return [...replay(input).best.values()].sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.key.localeCompare(b.key),
  );
}
