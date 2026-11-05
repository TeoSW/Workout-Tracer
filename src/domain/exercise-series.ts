import { movingAverage7 } from './bodyweight';
import { dayNumber, type DateStr } from './dates';
import { bestE1rmPerSession } from './e1rm';
import { formatChartValue, type ChartUnit } from './format';
import { bandLevel, effectiveLoad } from './load';
import { prHistory, type DatedPr, type SessionSets } from './prs';
import type { Band, BodyweightEntry, Exercise, LoggedSet, Session } from './schemas';
import { bestCleanHoldByLevel, complexBandSeries, setsBySession } from './skills';
import { finishedSessionsById } from './sets';

/** One point in time. `day` comes from dayNumber, so gaps between sessions show as gaps. */
export type ChartRow = { day: number } & Record<string, number | null>;

export type ChartSeries = {
  key: string;
  label: string;
  /** Categorical color slot, kept by the series whatever else is showing. */
  slot: number;
  /** Plots points without a line, for raw values under an average. */
  dotsOnly?: boolean;
  /** Plots a line without points, for an average over raw values. */
  lineOnly?: boolean;
};

export type ChartSpec = {
  id: string;
  title: string;
  unit: ChartUnit;
  /** "/hand" or "/side" on loads, which stay as logged. */
  suffix?: string;
  reversed?: boolean;
  note?: string;
  /** The numbers in words, so none of them needs a tap to be read. */
  readout: string;
  series: ChartSeries[];
  rows: ChartRow[];
};

type Input = {
  exercise: Exercise;
  sessions: readonly Session[];
  sets: readonly LoggedSet[];
  bodyweight: readonly BodyweightEntry[];
  bandsById: ReadonlyMap<string, Band>;
};

type Point = { date: DateStr; value: number };
type Options = Partial<Pick<ChartSpec, 'suffix' | 'reversed' | 'note'>>;

const LEVEL_COLORS = 8;
const LOWER_IS_HARDER: Options = { reversed: true, note: 'Lower is harder.' };

const loadSuffix = (exercise: Exercise) =>
  exercise.loadUnit === 'per_hand' ? '/hand' : exercise.loadUnit === 'per_side' ? '/side' : '';

/** A chart with one line, or null when there is nothing to plot. */
function single(
  id: string,
  title: string,
  unit: ChartUnit,
  points: readonly Point[],
  options: Options = {},
): ChartSpec | null {
  const latest = points.at(-1);
  if (!latest) return null;
  const values = points.map((p) => p.value);
  const best = options.reversed ? Math.min(...values) : Math.max(...values);
  const format = (value: number) => formatChartValue(value, unit, options.suffix);
  return {
    id,
    title,
    unit,
    ...options,
    readout: `Latest ${format(latest.value)}, best ${format(best)}`,
    series: [{ key: 'value', label: title, slot: 1 }],
    rows: points.map((p) => ({ day: dayNumber(p.date), value: p.value })),
  };
}

/** The one number a session gives for a set of its sets, oldest session first. */
function perSession(
  input: Input,
  pick: (sets: LoggedSet[], session: Session) => number | null,
): Point[] {
  return setsBySession({ ...input, exerciseId: input.exercise.id }).flatMap(({ session, sets }) => {
    const value = pick(sets, session);
    return value === null ? [] : [{ date: session.date, value }];
  });
}

function bestOf(values: readonly number[]): number | null {
  return values.length === 0 ? null : Math.max(...values);
}

function e1rmChart(input: Input): ChartSpec | null {
  const points = bestE1rmPerSession(input).map((p) => ({ date: p.date, value: p.e1rm }));
  return single('e1rm', 'e1RM trend', 'kg', points, { suffix: loadSuffix(input.exercise) });
}

function heaviestChart(input: Input): ChartSpec | null {
  const points = perSession(input, (sets) => bestOf(sets.flatMap((s) => s.kg ?? [])));
  return single('load', 'Heaviest load', 'kg', points, { suffix: loadSuffix(input.exercise) });
}

/**
 * Bodyweight plus added kg, or the added kg alone when no bodyweight is logged. Sessions from
 * before the first bodyweight entry are left out, or the line would jump by a whole bodyweight.
 */
function effectiveLoadChart(input: Input): ChartSpec | null {
  const { exercise, bodyweight } = input;
  const loads = setsBySession({ ...input, exerciseId: exercise.id }).flatMap(({ session, sets }) =>
    sets.flatMap((set) => {
      const load = effectiveLoad(set, exercise, bodyweight, session.date);
      return load ? [{ date: session.date, ...load }] : [];
    }),
  );
  const withBodyweight = loads.filter((l) => l.includesBodyweight);
  const known = withBodyweight.length > 0;
  const best = new Map<DateStr, number>();
  for (const load of known ? withBodyweight : loads) {
    best.set(load.date, Math.max(best.get(load.date) ?? 0, load.kg));
  }
  const points = [...best].map(([date, value]) => ({ date, value }));
  return single('load', known ? 'Effective load' : 'Added kg', 'kg', points);
}

function bandChart(input: Input): ChartSpec | null {
  const points = perSession(input, (sets) => {
    const banded = sets.filter((s) => (s.bandIds?.length ?? 0) > 0);
    if (banded.length === 0) return null;
    return Math.min(...banded.map((s) => bandLevel(s.bandIds, input.bandsById)));
  });
  return single('band', 'Band level', 'band', points, LOWER_IS_HARDER);
}

function bestRepsChart(input: Input): ChartSpec | null {
  const points = perSession(input, (sets) => {
    const plain = sets.filter((s) => (s.bandIds?.length ?? 0) === 0 && (s.addedKg ?? 0) <= 0);
    return bestOf(plain.flatMap((s) => s.reps ?? []));
  });
  return single('reps', 'Best reps', 'reps', points);
}

/** Levels in ladder order, so a level keeps its color. Levels off the ladder come after it. */
function orderedLevels(exercise: Exercise, logged: ReadonlySet<string>): string[] {
  const ladder = exercise.progressionLadder ?? [];
  const extra = [...logged].filter((l) => !ladder.includes(l)).sort((a, b) => a.localeCompare(b));
  return [...ladder, ...extra];
}

function holdChart(input: Input): ChartSpec | null {
  const { exercise } = input;
  const points = bestCleanHoldByLevel({ ...input, exerciseId: exercise.id });
  if (points.length === 0) return null;

  const levels = orderedLevels(exercise, new Set(points.map((p) => p.level)));
  const fold = levels.length > LEVEL_COLORS;
  const seriesOf = (level: string): ChartSeries => {
    const position = levels.indexOf(level);
    if (fold && position >= LEVEL_COLORS - 1) {
      return { key: 'other', label: 'Other', slot: LEVEL_COLORS };
    }
    return {
      key: `level${position}`,
      label: level === '' ? 'No level' : level,
      slot: position + 1,
    };
  };

  const series = new Map<string, ChartSeries>();
  for (const level of levels) {
    if (!points.some((p) => p.level === level)) continue;
    const entry = seriesOf(level);
    series.set(entry.key, entry);
  }
  const empty = () => Object.fromEntries([...series.keys()].map((key) => [key, null]));
  const rows = new Map<string, ChartRow>();
  for (const point of points) {
    const row = rows.get(point.sessionId) ?? { day: dayNumber(point.date), ...empty() };
    const { key } = seriesOf(point.level);
    row[key] = Math.max(row[key] ?? 0, point.seconds);
    rows.set(point.sessionId, row);
  }

  const best = [...series.values()].map((s) => {
    const seconds = Math.max(...[...rows.values()].map((row) => row[s.key] ?? 0));
    return `${s.label} ${formatChartValue(seconds, 'seconds')}`;
  });
  return {
    id: 'hold',
    title: 'Best clean hold',
    unit: 'seconds',
    readout: `Best: ${best.join(', ')}`,
    series: [...series.values()],
    rows: [...rows.values()],
  };
}

function complexCharts(input: Input): (ChartSpec | null)[] {
  const points = complexBandSeries({ ...input, exerciseId: input.exercise.id });
  return [
    single(
      'band',
      'Band level',
      'band',
      points.map((p) => ({ date: p.date, value: p.bandLevel })),
      LOWER_IS_HARDER,
    ),
    single(
      'clean',
      'Clean sets',
      'share',
      points.map((p) => ({ date: p.date, value: p.cleanShare })),
    ),
  ];
}

function attemptsChart(input: Input): ChartSpec | null {
  const rows = setsBySession({ ...input, exerciseId: input.exercise.id }).map(
    ({ session, sets }) => ({
      day: dayNumber(session.date),
      clean: sets.reduce((sum, s) => sum + (s.cleanAttempts ?? 0), 0),
      total: sets.reduce((sum, s) => sum + (s.attempts ?? 0), 0),
    }),
  );
  const latest = rows.at(-1);
  if (!latest) return null;
  const best = Math.max(...rows.map((r) => r.clean));
  return {
    id: 'attempts',
    title: 'Attempts',
    unit: 'count',
    readout: `Latest ${latest.clean} of ${latest.total} clean, best ${best}`,
    series: [
      { key: 'clean', label: 'Clean', slot: 1 },
      { key: 'total', label: 'Total', slot: 2 },
    ],
    rows,
  };
}

/** The charts that fit an exercise's tracking type, for the data it has. */
export function exerciseCharts(input: Input): ChartSpec[] {
  const charts = (): (ChartSpec | null)[] => {
    switch (input.exercise.trackingType) {
      case 'weight_reps':
        return [e1rmChart(input), heaviestChart(input)];
      case 'bodyweight_reps':
        return [
          e1rmChart(input),
          effectiveLoadChart(input),
          bandChart(input),
          bestRepsChart(input),
        ];
      case 'hold':
        return [holdChart(input)];
      case 'complex':
        return complexCharts(input);
      case 'attempts':
        return [attemptsChart(input)];
      case 'checklist':
        return [];
    }
  };
  return charts().filter((chart) => chart !== null);
}

/** Raw entries as points under the line of their 7-day average. */
export function bodyweightChart(entries: readonly BodyweightEntry[]): ChartSpec | null {
  const points = movingAverage7(entries);
  const latest = points.at(-1);
  if (!latest) return null;
  return {
    id: 'bodyweight',
    title: 'Bodyweight',
    unit: 'kg',
    readout: `Latest ${formatChartValue(latest.kg, 'kg')}, 7-day average ${formatChartValue(latest.average, 'kg')}`,
    series: [
      { key: 'kg', label: 'Weight', slot: 2, dotsOnly: true },
      { key: 'average', label: '7-day average', slot: 1, lineOnly: true },
    ],
    rows: points.map((p) => ({ day: dayNumber(p.date), kg: p.kg, average: p.average })),
  };
}

/** Logged sets by session, newest first, warm-ups included. This is the full set history. */
export function sessionLog(
  sessions: readonly Session[],
  sets: readonly LoggedSet[],
): SessionSets[] {
  const byId = finishedSessionsById(sessions);
  const entries = new Map<string, SessionSets>();
  for (const set of sets) {
    const session = byId.get(set.sessionId);
    if (!session || !set.done) continue;
    const entry = entries.get(session.id);
    if (entry) entry.sets.push(set);
    else entries.set(session.id, { session, sets: [set] });
  }
  for (const entry of entries.values()) entry.sets.sort((a, b) => a.order - b.order);
  return [...entries.values()].sort((a, b) => b.session.startedAt - a.session.startedAt);
}

export type RecentPr = DatedPr & { exerciseId: string };

/** The latest records across all exercises, newest first. */
export function recentPrs(input: {
  sessions: readonly Session[];
  sets: readonly LoggedSet[];
  exercisesById: ReadonlyMap<string, Exercise>;
  bandsById: ReadonlyMap<string, Band>;
  bodyweight: readonly BodyweightEntry[];
  limit: number;
}): RecentPr[] {
  const sessions = finishedSessionsById(input.sessions);
  const byExercise = new Map<string, Map<string, SessionSets>>();
  for (const set of input.sets) {
    const session = sessions.get(set.sessionId);
    if (!session) continue;
    const entries = byExercise.get(set.exerciseId) ?? new Map<string, SessionSets>();
    byExercise.set(set.exerciseId, entries);
    const entry = entries.get(session.id);
    if (entry) entry.sets.push(set);
    else entries.set(session.id, { session, sets: [set] });
  }

  const prs = [...byExercise].flatMap(([exerciseId, entries]) => {
    const exercise = input.exercisesById.get(exerciseId);
    if (!exercise) return [];
    return prHistory({ ...input, exercise, sessions: [...entries.values()] }).map((pr) => ({
      ...pr,
      exerciseId,
    }));
  });
  return prs.sort((a, b) => b.date.localeCompare(a.date)).slice(0, input.limit);
}
