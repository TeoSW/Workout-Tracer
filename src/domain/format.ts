import { format } from 'date-fns';
import { parseDateStr, type DateStr } from './dates';
import { effortModeFor, formatEffort } from './effort';
import type { PrFlag } from './prs';
import type { Band, EffortMode, Exercise, ExerciseBlock, LoggedSet, SetTarget } from './schemas';
import { round2 } from './sets';

const range = (min: number, max: number | undefined) =>
  max === undefined || max === min ? `${min}` : `${min}-${max}`;

export const formatKg = (kg: number) => `${kg}kg`;

/** "4kg/hand", "5-7.5kg/side", "+25kg". Empty when the target has no load. */
export function formatLoad(target: SetTarget, exercise: Exercise): string {
  if ((target.addedKg ?? 0) > 0) return `+${formatKg(target.addedKg ?? 0)}`;
  if (target.loadMinKg === undefined) return '';
  const suffix =
    exercise.loadUnit === 'per_hand' ? '/hand' : exercise.loadUnit === 'per_side' ? '/side' : '';
  return `${range(target.loadMinKg, target.loadMaxKg)}kg${suffix}`;
}

/** "35+15kg" with the heaviest band first, or "no band". */
export function formatBandLevel(
  bandIds: readonly string[],
  bandsById: ReadonlyMap<string, Band>,
): string {
  const rated = bandIds.flatMap((id) => {
    const band = bandsById.get(id);
    return band ? [band.ratedKg] : [];
  });
  if (rated.length === 0) return 'no band';
  return `${rated.sort((a, b) => b - a).join('+')}kg`;
}

/** "3 x 8-12", "3-4 x 5-10s", "4-6 attempts". Empty for a checklist item. */
const LEG_MUSCLES = new Set(['glutes', 'quads', 'hamstrings', 'adductors', 'abductors', 'calves']);
const ARM_MUSCLES = new Set([
  'chest',
  'lats',
  'upper_back',
  'traps',
  'front_delts',
  'side_delts',
  'rear_delts',
  'biceps',
  'triceps',
  'forearms',
]);

/** What "per" means for a one-sided exercise: a leg, an arm, or a side for core work. */
function limbOf(exercise: Exercise): 'leg' | 'arm' | 'side' {
  if (exercise.primaryMuscles.some((m) => LEG_MUSCLES.has(m))) return 'leg';
  if (exercise.primaryMuscles.some((m) => ARM_MUSCLES.has(m))) return 'arm';
  return 'side';
}

export function formatSetsTarget(
  block: Pick<ExerciseBlock, 'setsMin' | 'setsMax' | 'target'>,
  exercise: Exercise,
): string {
  const { target } = block;
  const sets = range(block.setsMin, block.setsMax);
  if (exercise.trackingType === 'checklist') return '';
  if (target.attemptsMin !== undefined) {
    const attempts = `${range(target.attemptsMin, target.attemptsMax)} attempts`;
    return block.setsMin > 1 ? `${sets} x ${attempts}` : attempts;
  }
  if (target.parts && target.parts.length > 0) {
    const parts = target.parts.map((p) => {
      const name = p.name.toLowerCase();
      return p.unit === 'seconds' ? `${name} ${p.target}s` : `${name} ${p.target}`;
    });
    return `${sets} x ${parts.join(', ')}`;
  }
  if (target.isMax) return `${sets} x max`;
  if (target.secondsMin !== undefined) {
    return `${sets} x ${range(target.secondsMin, target.secondsMax)}s`;
  }
  if (target.repsMin !== undefined) {
    const perSide = exercise.unilateral ? ` /${limbOf(exercise)}` : '';
    return `${sets} x ${range(target.repsMin, target.repsMax)}${perSide}`;
  }
  return block.setsMin === 1 && block.setsMax === undefined ? '1 set' : `${sets} sets`;
}

/** The line under an exercise name: "3 x 8-12 · band 35+15kg". */
export function formatPlanLine(
  block: Pick<ExerciseBlock, 'setsMin' | 'setsMax' | 'target'>,
  exercise: Exercise,
  bandsById: ReadonlyMap<string, Band>,
  /** Adds the planned effort for every set, in this mode. Left out, the effort isn't shown. */
  effortMode?: EffortMode,
): string {
  const { target } = block;
  const parts = [formatSetsTarget(block, exercise)];
  if (target.bandIds !== undefined) {
    parts.push(
      target.bandIds.length > 0 ? `band ${formatBandLevel(target.bandIds, bandsById)}` : 'no band',
    );
  } else {
    parts.push(formatLoad(target, exercise));
  }
  if (target.progressionLevel !== undefined && target.progressionLevel !== 'current') {
    parts.push(target.progressionLevel);
  }
  if (effortMode !== undefined && target.rir !== undefined) {
    parts.push(formatEffort(target.rir, effortModeFor(effortMode, exercise)));
  }
  return parts.filter((p) => p !== '').join(' · ');
}

export const formatCycleWeek = (week: number, total: number) => `Week ${week} of ${total}`;

/** "3 Nov". */
export const formatShortDate = (date: DateStr) => format(parseDateStr(date), 'd MMM');

/** "Wed 4 Nov". */
export const formatWeekdayDate = (date: DateStr) => format(parseDateStr(date), 'EEE d MMM');

/** "3 Nov 2026", for lists that run across years. */
export const formatDateWithYear = (date: DateStr) => format(parseDateStr(date), 'd MMM yyyy');

/** "Tuesday 3 November". */
export const formatLongDate = (date: DateStr) => format(parseDateStr(date), 'EEEE d MMMM');

/** "November 2026". */
export const formatMonth = (month: string) => format(parseDateStr(`${month}-01`), 'MMMM yyyy');

/** What a calendar day says to a screen reader, where its color can't. */
export function formatDayLabel(date: DateStr, sessions: readonly { name: string }[]): string {
  return [formatLongDate(date), ...sessions.map((s) => s.name)].join(', ');
}

export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export type ChartUnit = 'kg' | 'seconds' | 'reps' | 'band' | 'share' | 'count';

export function formatChartValue(value: number, unit: ChartUnit, suffix = ''): string {
  switch (unit) {
    case 'kg':
      return `${formatKg(round2(value))}${suffix}`;
    case 'seconds':
      return `${value}s`;
    case 'reps':
      return `${value} reps`;
    case 'band':
      return value === 0 ? 'No band' : formatKg(round2(value));
    case 'share':
      return `${Math.round(value * 100)}%`;
    case 'count':
      return `${value}`;
  }
}

/** "48m" or "1h 05m". */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

function loggedLoad(set: LoggedSet, exercise: Exercise): string {
  if (set.kg === undefined) return '';
  const suffix =
    exercise.loadUnit === 'per_hand' ? '/hand' : exercise.loadUnit === 'per_side' ? '/side' : '';
  return `${formatKg(set.kg)}${suffix}`;
}

function bandNumbers(bandIds: readonly string[], bandsById: ReadonlyMap<string, Band>): string {
  return formatBandLevel(bandIds, bandsById).replace(/kg$/, '');
}

/** The result of a set without its effort: "25kg x 10", "35+15 x 9", "4 of 6 clean". */
function formatSetValues(
  set: LoggedSet,
  exercise: Exercise,
  bandsById: ReadonlyMap<string, Band>,
): string {
  const bands = set.bandIds ?? [];
  const reps = set.reps ?? 0;
  switch (exercise.trackingType) {
    case 'weight_reps':
      return `${loggedLoad(set, exercise)} x ${reps}`;
    case 'bodyweight_reps':
      if (bands.length > 0) return `${bandNumbers(bands, bandsById)} x ${reps}`;
      if ((set.addedKg ?? 0) > 0) return `+${formatKg(set.addedKg ?? 0)} x ${reps}`;
      return `${reps} reps`;
    case 'hold': {
      const parts = [set.progressionLevel, `${set.seconds ?? 0}s`];
      if (bands.length > 0) parts.push(`band ${formatBandLevel(bands, bandsById)}`);
      if (set.clean) parts.push('clean');
      return parts.filter((p) => p !== undefined).join(' · ');
    }
    case 'complex': {
      const logged = (set.parts ?? []).map((p) => {
        const name = p.name.toLowerCase();
        return p.unit === 'seconds' ? `${name} ${p.value}s` : `${name} ${p.value}`;
      });
      const parts = [set.progressionLevel, logged.join(', ')];
      if (bands.length > 0) parts.push(`band ${formatBandLevel(bands, bandsById)}`);
      if (set.clean) parts.push('clean');
      return parts.filter((p) => p !== undefined && p !== '').join(' · ');
    }
    case 'attempts':
      return `${set.cleanAttempts ?? 0} of ${set.attempts ?? 0} clean`;
    case 'checklist':
      return 'Done';
  }
}

/** A done set in the logger: the result plus effort in the active mode. */
export function formatSetResult(
  set: LoggedSet,
  exercise: Exercise,
  effortMode: EffortMode,
  bandsById: ReadonlyMap<string, Band>,
): string {
  const effort = formatEffort(set.rir, effortMode);
  const values = formatSetValues(set, exercise, bandsById);
  return effort === '' ? values : `${values} · ${effort}`;
}

/** The hint on a pending set: "last: 35+15 x 9". */
export function formatLastTime(
  set: LoggedSet,
  exercise: Exercise,
  bandsById: ReadonlyMap<string, Band>,
): string {
  return `last: ${formatSetValues(set, exercise, bandsById)}`;
}

function repsKeyLabel(key: string): string {
  if (key.startsWith('kg:')) return formatKg(Number(key.slice(3)));
  if (key.startsWith('band:')) return `band ${formatKg(Number(key.slice(5)))}`;
  if (key.startsWith('added:')) return `+${formatKg(Number(key.slice(6)))}`;
  return key;
}

/** A record in words, without the exercise. */
export function formatRecord(pr: Pick<PrFlag, 'kind' | 'key' | 'value'>): string {
  const at = pr.key === '' ? '' : ` at ${pr.key}`;
  switch (pr.kind) {
    case 'heaviest_load':
      return `heaviest load ${formatKg(pr.value)}`;
    case 'best_e1rm':
      return `best e1RM trend ${formatKg(pr.value)}`;
    case 'most_reps':
      return `${pr.value} reps at ${repsKeyLabel(pr.key)}`;
    case 'longest_hold':
      return `longest clean hold ${pr.value}s${at}`;
    case 'lowest_band':
      return `lowest band ${formatKg(pr.value)}${at}`;
    case 'most_clean_attempts':
      return `${pr.value} clean attempts`;
  }
}

/** One line of the finish summary. */
export function formatPr(pr: Pick<PrFlag, 'kind' | 'key' | 'value'>, exercise: Exercise): string {
  return `${exercise.name}: ${formatRecord(pr)}`;
}
