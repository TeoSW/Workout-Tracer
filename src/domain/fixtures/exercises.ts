import type { Exercise, LoadUnit, Muscle, TrackingType } from '../schemas';

export const PROGRESSION_LADDER = ['Tuck', 'Advanced tuck', 'Straddle', 'Full'];

type Flags = {
  loadUnit?: LoadUnit;
  unilateral?: boolean;
  ladder?: boolean;
  alternativeIds?: string[];
};

function e(
  id: string,
  name: string,
  trackingType: TrackingType,
  primaryMuscles: Muscle[],
  secondaryMuscles: Muscle[],
  defaultRestSec: number,
  flags: Flags = {},
): Exercise {
  return {
    id,
    name,
    trackingType,
    primaryMuscles,
    secondaryMuscles,
    unilateral: flags.unilateral ?? false,
    loadUnit: flags.loadUnit ?? 'total',
    defaultRestSec,
    cues: '',
    alternativeIds: flags.alternativeIds ?? [],
    ...(flags.ladder ? { progressionLadder: [...PROGRESSION_LADDER] } : {}),
    isCustom: false,
    archived: false,
  };
}

const perHand = { loadUnit: 'per_hand' } as const;

/** The built-in library from spec section 9.2. Ids are stable so templates and shares can point at them. */
export const SEED_EXERCISES: Exercise[] = [
  e('pull-ups', 'Pull-ups', 'bodyweight_reps', ['lats'], ['biceps', 'upper_back'], 120),
  e(
    'upper-chest',
    'Upper Chest',
    'weight_reps',
    ['chest'],
    ['front_delts', 'triceps'],
    120,
    perHand,
  ),
  e('kelso-shrug', 'Kelso Shrug', 'weight_reps', ['upper_back'], [], 75, perHand),
  e('lateral-raise', 'Lateral Raise', 'weight_reps', ['side_delts'], [], 75, {
    ...perHand,
    alternativeIds: ['cable-lateral-raise', 'machine-lateral-raise', 'lean-away-lateral-raise'],
  }),
  e('tricep-above-head', 'Tricep Above Head', 'weight_reps', ['triceps'], [], 75, {
    alternativeIds: [
      'cable-overhead-triceps-extension',
      'single-arm-db-overhead-extension',
      'ez-bar-skull-crusher',
    ],
  }),
  e(
    'mid-back-row',
    'Mid Back Row',
    'weight_reps',
    ['upper_back'],
    ['lats', 'rear_delts', 'biceps'],
    120,
  ),
  e('reverse-fly', 'Reverse Fly', 'weight_reps', ['rear_delts'], ['upper_back'], 75, perHand),
  e(
    'military-press',
    'Military Press',
    'weight_reps',
    ['front_delts'],
    ['triceps', 'side_delts'],
    120,
    perHand,
  ),
  e(
    'push-ups-incline',
    'Push-ups (incline)',
    'bodyweight_reps',
    ['chest'],
    ['triceps', 'front_delts'],
    90,
  ),
  e('bicep-curl', 'Bicep Curl', 'weight_reps', ['biceps'], ['forearms'], 75, perHand),
  e('tricep-below-head', 'Tricep Below Head', 'weight_reps', ['triceps'], [], 75),
  e('squat', 'Squat', 'weight_reps', ['quads'], ['glutes', 'adductors'], 120),
  e(
    'bulgarian-split-squat',
    'Bulgarian Split Squat',
    'weight_reps',
    ['quads'],
    ['glutes', 'adductors'],
    120,
    {
      unilateral: true,
    },
  ),
  e('hip-thrust', 'Hip Thrust', 'weight_reps', ['glutes'], ['hamstrings'], 120),
  e(
    'lumbar-extension',
    'Lumbar Extension',
    'weight_reps',
    ['lower_back'],
    ['glutes', 'hamstrings'],
    90,
  ),
  e('leg-extension', 'Leg Extension', 'weight_reps', ['quads'], [], 75, { loadUnit: 'per_side' }),
  e('hamstring-curl', 'Hamstring Curl', 'weight_reps', ['hamstrings'], [], 75),
  e('adductors', 'Adductors', 'weight_reps', ['adductors'], [], 75),
  e('abductors', 'Abductors', 'weight_reps', ['abductors'], ['glutes'], 75),
  e('calf-raise', 'Calf Raise', 'weight_reps', ['calves'], [], 75),
  e('ab-crunch', 'Ab Crunch', 'weight_reps', ['abs'], [], 75),
  e('cable-lateral-raise', 'Cable Lateral Raise (one arm)', 'weight_reps', ['side_delts'], [], 75, {
    unilateral: true,
  }),
  e('machine-lateral-raise', 'Machine Lateral Raise', 'weight_reps', ['side_delts'], [], 75),
  e('lean-away-lateral-raise', 'Lean-away Lateral Raise', 'weight_reps', ['side_delts'], [], 75, {
    unilateral: true,
  }),
  e(
    'cable-overhead-triceps-extension',
    'Cable Overhead Triceps Extension (rope)',
    'weight_reps',
    ['triceps'],
    [],
    75,
  ),
  e(
    'single-arm-db-overhead-extension',
    'Single-arm Dumbbell Overhead Extension',
    'weight_reps',
    ['triceps'],
    [],
    75,
    {
      unilateral: true,
    },
  ),
  e('ez-bar-skull-crusher', 'EZ-bar Skull Crusher', 'weight_reps', ['triceps'], [], 75),
  e(
    'planche-complex',
    'Planche Complex',
    'complex',
    ['front_delts'],
    ['chest', 'triceps', 'abs'],
    180,
    {
      ladder: true,
    },
  ),
  e(
    'front-lever-complex',
    'Front Lever Complex',
    'complex',
    ['lats'],
    ['abs', 'upper_back', 'rear_delts'],
    180,
    {
      ladder: true,
    },
  ),
  e('planche-hold', 'Planche Hold', 'hold', ['front_delts'], ['chest', 'triceps', 'abs'], 120, {
    ladder: true,
  }),
  e(
    'front-lever-hold',
    'Front Lever Hold',
    'hold',
    ['lats'],
    ['abs', 'upper_back', 'rear_delts'],
    120,
    {
      ladder: true,
    },
  ),
  e(
    'weighted-dips',
    'Weighted Dips',
    'bodyweight_reps',
    ['chest'],
    ['triceps', 'front_delts'],
    150,
  ),
  e(
    'weighted-pull-ups',
    'Weighted Pull-ups',
    'bodyweight_reps',
    ['lats'],
    ['biceps', 'upper_back'],
    150,
  ),
  e('planche-lean', 'Planche Lean', 'hold', ['front_delts'], ['chest', 'abs'], 120),
  e('front-lever-raises', 'Front Lever Raises', 'bodyweight_reps', ['lats'], ['abs'], 120, {
    ladder: true,
  }),
  e('hollow-body-hold', 'Hollow Body Hold', 'hold', ['abs'], [], 90),
  e('360', '360', 'attempts', [], [], 150),
  e('540', '540', 'attempts', [], [], 150),
  e('shrimp-flip', 'Shrimp Flip', 'attempts', [], [], 150),
  e('warm-up', 'Warm-up', 'checklist', [], [], 0),
  e(
    'barbell-back-squat',
    'Barbell Back Squat',
    'weight_reps',
    ['quads'],
    ['glutes', 'adductors'],
    150,
  ),
  e('bench-press', 'Bench Press', 'weight_reps', ['chest'], ['triceps', 'front_delts'], 150),
  e(
    'deadlift',
    'Deadlift',
    'weight_reps',
    ['glutes', 'hamstrings'],
    ['lower_back', 'upper_back', 'traps', 'forearms'],
    180,
  ),
  e(
    'romanian-deadlift',
    'Romanian Deadlift',
    'weight_reps',
    ['hamstrings'],
    ['glutes', 'lower_back'],
    120,
  ),
  e(
    'overhead-press',
    'Overhead Press',
    'weight_reps',
    ['front_delts'],
    ['triceps', 'side_delts'],
    120,
  ),
  e(
    'barbell-row',
    'Barbell Row',
    'weight_reps',
    ['upper_back'],
    ['lats', 'rear_delts', 'biceps'],
    120,
  ),
  e('lat-pulldown', 'Lat Pulldown', 'weight_reps', ['lats'], ['biceps', 'upper_back'], 120),
  e(
    'seated-cable-row',
    'Seated Cable Row',
    'weight_reps',
    ['upper_back'],
    ['lats', 'rear_delts', 'biceps'],
    120,
  ),
  e(
    'incline-db-press',
    'Incline Dumbbell Press',
    'weight_reps',
    ['chest'],
    ['front_delts', 'triceps'],
    120,
    perHand,
  ),
  e('leg-press', 'Leg Press', 'weight_reps', ['quads'], ['glutes'], 120),
  e('triceps-pushdown', 'Triceps Pushdown', 'weight_reps', ['triceps'], [], 75),
  e('hammer-curl', 'Hammer Curl', 'weight_reps', ['biceps'], ['forearms'], 75, perHand),
  e('face-pull', 'Face Pull', 'weight_reps', ['rear_delts'], ['upper_back'], 75),
  e('plank', 'Plank', 'hold', ['abs'], [], 60),
];
