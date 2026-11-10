import type { DayType, MissedReason, Muscle, SplitType, TrackingType } from '../domain/schemas';

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: 'Chest',
  lats: 'Lats',
  upper_back: 'Upper back',
  traps: 'Traps',
  front_delts: 'Front delts',
  side_delts: 'Side delts',
  rear_delts: 'Rear delts',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  lower_back: 'Lower back',
  glutes: 'Glutes',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  adductors: 'Adductors',
  abductors: 'Abductors',
  calves: 'Calves',
};

export const TRACKING_LABELS: Record<TrackingType, string> = {
  weight_reps: 'Weight and reps',
  bodyweight_reps: 'Bodyweight reps',
  hold: 'Hold',
  complex: 'Complex',
  attempts: 'Attempts',
  checklist: 'Checklist',
};

export const SPLIT_LABELS: Record<SplitType, string> = {
  full_body: 'Full body',
  upper_lower: 'Upper/lower',
  ppl: 'Push/pull/legs',
  ppll: 'PPLL',
  ulu_lul_rotation: 'ULU/LUL rotation',
  calisthenics_cycle: 'Calisthenics cycle',
  custom: 'Custom',
};

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  hypertrophy: 'Hypertrophy',
  strength: 'Strength',
  skill_heavy: 'Skill heavy',
  skill_light: 'Skill light',
  dynamics: 'Dynamics',
  test: 'Test',
  conditioning: 'Conditioning',
  custom: 'Custom',
};

export const MISSED_REASON_LABELS: Record<MissedReason, string> = {
  sick: 'Sick',
  busy: 'Busy',
  pain: 'Pain',
  travel: 'Travel',
  other: 'Other',
};
