import type { EffortMode, Exercise, TrackingType } from './schemas';

const isHalfStep = (n: number) => Number.isFinite(n) && Number.isInteger(n * 2);

export const RIR_VALUES = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
export const RPE_VALUES = RIR_VALUES.map((rir) => 10 - rir).reverse();

export function isValidRir(rir: number): boolean {
  return isHalfStep(rir) && rir >= 0 && rir <= 5;
}

export function isValidRpe(rpe: number): boolean {
  return isHalfStep(rpe) && rpe >= 5 && rpe <= 10;
}

/** RPE input is stored as RIR: rir = 10 - rpe. */
export function rpeToRir(rpe: number): number {
  if (!isValidRpe(rpe)) throw new Error(`RPE must be 5 to 10 in steps of 0.5, got ${rpe}`);
  return 10 - rpe;
}

export function rirToRpe(rir: number): number {
  if (!isValidRir(rir)) throw new Error(`RIR must be 0 to 5 in steps of 0.5, got ${rir}`);
  return 10 - rir;
}

/** Only rep-based sets take RIR or RPE. Holds and complexes use a clean flag instead. */
export function usesEffort(trackingType: TrackingType): boolean {
  return trackingType === 'weight_reps' || trackingType === 'bodyweight_reps';
}

export function effortModeFor(globalMode: EffortMode, exercise: Exercise): EffortMode {
  if (!usesEffort(exercise.trackingType)) return 'off';
  return exercise.effortInput ?? globalMode;
}

export function formatEffort(rir: number | null, mode: EffortMode): string {
  if (rir === null || mode === 'off') return '';
  if (mode === 'rpe') return `RPE ${rirToRpe(rir)}`;
  return rir >= 5 ? 'RIR 5+' : `RIR ${rir}`;
}
