import type { Band, Exercise, ExerciseBlock, SetTarget } from './schemas';

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
    const perSide = exercise.unilateral ? ' /leg' : '';
    return `${sets} x ${range(target.repsMin, target.repsMax)}${perSide}`;
  }
  return block.setsMin === 1 && block.setsMax === undefined ? '1 set' : `${sets} sets`;
}

/** The line under an exercise name: "3 x 8-12 · band 35+15kg". */
export function formatPlanLine(
  block: Pick<ExerciseBlock, 'setsMin' | 'setsMax' | 'target'>,
  exercise: Exercise,
  bandsById: ReadonlyMap<string, Band>,
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
  return parts.filter((p) => p !== '').join(' · ');
}

export const formatCycleWeek = (week: number, total: number) => `Week ${week} of ${total}`;

/** "48m" or "1h 05m". */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}
