import type { Exercise, Muscle, TrackingType } from './schemas';

export type ExerciseFilter = {
  query: string;
  muscle: Muscle | 'all';
  trackingType: TrackingType | 'all';
};

/** A muscle matches as primary or secondary. Search ignores case. */
export function filterExercises(
  exercises: readonly Exercise[],
  filter: ExerciseFilter,
): Exercise[] {
  const query = filter.query.trim().toLowerCase();
  const { muscle, trackingType } = filter;
  return exercises.filter(
    (e) =>
      (query === '' || e.name.toLowerCase().includes(query)) &&
      (trackingType === 'all' || e.trackingType === trackingType) &&
      (muscle === 'all' ||
        e.primaryMuscles.includes(muscle) ||
        e.secondaryMuscles.includes(muscle)),
  );
}
