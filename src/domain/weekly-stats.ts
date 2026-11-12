import { sessionTimes } from './consistency';
import { addDays, dayNumber, mondayOf, type DateStr } from './dates';
import type { ChartSpec } from './exercise-series';
import { formatBandLevel, formatChartValue, formatShortDate } from './format';
import { bandLevel, bodyweightOn } from './load';
import type { Band, BodyweightEntry, Exercise, LoggedSet, Session } from './schemas';
import { countsForStats, finishedSessionsById } from './sets';

/**
 * Kg moved in one set: load x reps. Per-hand loads count both hands. Bodyweight exercises count
 * bodyweight plus added kg when a bodyweight entry exists, otherwise the added kg alone. Holds,
 * complexes and attempts move no counted load.
 */
export function setVolumeKg(
  set: LoggedSet,
  exercise: Exercise,
  bodyweight: readonly BodyweightEntry[],
  date: DateStr,
): number {
  const reps = set.reps ?? 0;
  if (reps === 0) return 0;
  if (exercise.trackingType === 'weight_reps') {
    const kg = set.kg ?? 0;
    return kg * reps * (exercise.loadUnit === 'per_hand' ? 2 : 1);
  }
  if (exercise.trackingType === 'bodyweight_reps') {
    const bw = bodyweightOn(bodyweight, date) ?? 0;
    return (bw + (set.addedKg ?? 0)) * reps;
  }
  return 0;
}

export type WeekStats = {
  weekStart: DateStr;
  volumeKg: number;
  sets: number;
  reps: number;
  totalMinutes: number;
  workingMinutes: number;
  workouts: number;
};

type Input = {
  sessions: readonly Session[];
  sets: readonly LoggedSet[];
  exercisesById: ReadonlyMap<string, Exercise>;
  bodyweight: readonly BodyweightEntry[];
  today: DateStr;
  weeks?: number;
};

/** The latest `weeks` Monday-to-Sunday weeks, oldest first, this week included. */
export function weeklyStats(input: Input): WeekStats[] {
  const count = input.weeks ?? 8;
  const thisWeek = mondayOf(input.today);
  const weeks = Array.from({ length: count }, (_, i) => addDays(thisWeek, -7 * (count - 1 - i)));
  const byWeek = new Map<DateStr, WeekStats>(
    weeks.map((w) => [
      w,
      {
        weekStart: w,
        volumeKg: 0,
        sets: 0,
        reps: 0,
        totalMinutes: 0,
        workingMinutes: 0,
        workouts: 0,
      },
    ]),
  );
  const finished = finishedSessionsById([...input.sessions]);
  for (const session of finished.values()) {
    const week = byWeek.get(mondayOf(session.date));
    if (!week) continue;
    week.workouts += 1;
    const times = sessionTimes(session);
    if (times) {
      week.totalMinutes += Math.round(times.totalMs / 60_000);
      week.workingMinutes += Math.round(times.workingMs / 60_000);
    }
  }
  for (const set of input.sets) {
    if (!countsForStats(set)) continue;
    const session = finished.get(set.sessionId);
    const exercise = input.exercisesById.get(set.exerciseId);
    if (!session || !exercise) continue;
    const week = byWeek.get(mondayOf(session.date));
    if (!week) continue;
    week.sets += 1;
    week.reps += set.reps ?? 0;
    week.volumeKg += setVolumeKg(set, exercise, input.bodyweight, session.date);
  }
  return weeks.map((w) => byWeek.get(w) as WeekStats);
}

function change(now: number, before: number): string {
  if (before === 0) return '';
  const percent = Math.round(((now - before) / before) * 100);
  return ` (${percent >= 0 ? '+' : ''}${percent}%)`;
}

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

/** Volume, sets and reps, and time per week, with this week against last and the 4-week mean. */
export function weeklyCharts(input: Input): ChartSpec[] {
  const weeks = weeklyStats(input);
  const current = weeks.at(-1);
  const last = weeks.at(-2);
  if (!current || weeks.every((w) => w.workouts === 0)) return [];
  const previous4 = weeks.slice(-5, -1);
  const kg = (v: number) => formatChartValue(Math.round(v), 'kg');
  const row = (w: WeekStats) => ({ day: dayNumber(w.weekStart) });

  const charts: ChartSpec[] = [
    {
      id: 'volume',
      title: 'Volume per week',
      unit: 'kg',
      readout: `This week ${kg(current.volumeKg)}, last week ${kg(last?.volumeKg ?? 0)}${change(
        current.volumeKg,
        last?.volumeKg ?? 0,
      )}, 4-week average ${kg(average(previous4.map((w) => w.volumeKg)))}`,
      note: 'Kg x reps of working sets. Bodyweight exercises count your bodyweight plus added kg.',
      series: [{ key: 'volume', label: 'Volume', slot: 1 }],
      rows: weeks.map((w) => ({ ...row(w), volume: Math.round(w.volumeKg) })),
    },
    {
      id: 'sets-reps',
      title: 'Sets and reps per week',
      unit: 'count',
      readout: `This week ${count(current.sets, 'set')} and ${count(current.reps, 'rep')}, last week ${count(last?.sets ?? 0, 'set')} and ${count(last?.reps ?? 0, 'rep')}`,
      series: [
        { key: 'sets', label: 'Sets', slot: 1 },
        { key: 'reps', label: 'Reps', slot: 2 },
      ],
      rows: weeks.map((w) => ({ ...row(w), sets: w.sets, reps: w.reps })),
    },
  ];
  if (weeks.some((w) => w.totalMinutes > 0)) {
    const timed = weeks.filter((w) => w.totalMinutes > 0);
    const perWorkout = average(
      timed.flatMap((w) => (w.workouts > 0 ? [w.totalMinutes / w.workouts] : [])),
    );
    charts.push({
      id: 'time',
      title: 'Time per week',
      unit: 'minutes',
      readout: `This week ${formatChartValue(current.totalMinutes, 'minutes')} in total, ${formatChartValue(
        current.workingMinutes,
        'minutes',
      )} working, about ${formatChartValue(Math.round(perWorkout), 'minutes')} per workout`,
      note: 'Working time is the total minus the rest timer.',
      series: [
        { key: 'total', label: 'Total', slot: 1 },
        { key: 'working', label: 'Working', slot: 2 },
      ],
      rows: weeks.map((w) => ({ ...row(w), total: w.totalMinutes, working: w.workingMinutes })),
    });
  }
  return charts;
}

/** Kg moved per workout for one exercise, oldest first. Null when it moves no counted load. */
export function volumeChart(input: {
  exercise: Exercise;
  sessions: readonly Session[];
  sets: readonly LoggedSet[];
  bodyweight: readonly BodyweightEntry[];
}): ChartSpec | null {
  const { exercise } = input;
  if (exercise.trackingType !== 'weight_reps' && exercise.trackingType !== 'bodyweight_reps') {
    return null;
  }
  const finished = finishedSessionsById([...input.sessions]);
  const bySession = new Map<string, { date: DateStr; kg: number }>();
  for (const set of input.sets) {
    if (set.exerciseId !== exercise.id || !countsForStats(set)) continue;
    const session = finished.get(set.sessionId);
    if (!session) continue;
    const entry = bySession.get(session.id) ?? { date: session.date, kg: 0 };
    entry.kg += setVolumeKg(set, exercise, input.bodyweight, session.date);
    bySession.set(session.id, entry);
  }
  const points = [...bySession.values()]
    .filter((p) => p.kg > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const latest = points.at(-1);
  if (!latest) return null;
  const best = Math.max(...points.map((p) => p.kg));
  const kg = (v: number) => formatChartValue(Math.round(v), 'kg');
  return {
    id: 'volume',
    title: 'Volume per workout',
    unit: 'kg',
    readout: `Latest ${kg(latest.kg)}, best ${kg(best)}`,
    series: [{ key: 'value', label: 'Volume', slot: 1 }],
    rows: points.map((p) => ({ day: dayNumber(p.date), value: Math.round(p.kg) })),
  };
}

/** How many working sets used each band level, and when the thinnest one so far began. */
export function bandUsage(input: {
  exercise: Exercise;
  sessions: readonly Session[];
  sets: readonly LoggedSet[];
  bandsById: ReadonlyMap<string, Band>;
}): { readout: string } | null {
  const finished = finishedSessionsById([...input.sessions]);
  const counts = new Map<string, { level: number; sets: number; first: DateStr }>();
  for (const set of input.sets) {
    if (set.exerciseId !== input.exercise.id || !countsForStats(set)) continue;
    if ((set.bandIds?.length ?? 0) === 0) continue;
    const session = finished.get(set.sessionId);
    if (!session) continue;
    const label = formatBandLevel(set.bandIds ?? [], input.bandsById);
    const entry = counts.get(label) ?? {
      level: bandLevel(set.bandIds, input.bandsById),
      sets: 0,
      first: session.date,
    };
    entry.sets += 1;
    if (session.date < entry.first) entry.first = session.date;
    counts.set(label, entry);
  }
  if (counts.size === 0) return null;
  const rows = [...counts.entries()].sort((a, b) => b[1].level - a[1].level);
  const parts = rows.map(([label, c]) => `${label} ${c.sets} ${c.sets === 1 ? 'set' : 'sets'}`);
  const thinnest = rows.at(-1);
  const since =
    thinnest && rows.length > 1
      ? `. Thinnest so far, ${thinnest[0]}, since ${formatShortDate(thinnest[1].first)}`
      : '';
  return { readout: `By band: ${parts.join(', ')}${since}` };
}
