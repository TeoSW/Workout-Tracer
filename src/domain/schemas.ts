import { z } from 'zod';
import { WEEKDAYS, isDateStr } from './dates';

export const MUSCLES = [
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
  'abs',
  'lower_back',
  'glutes',
  'quads',
  'hamstrings',
  'adductors',
  'abductors',
  'calves',
] as const;

export const TRACKING_TYPES = [
  'weight_reps',
  'bodyweight_reps',
  'hold',
  'complex',
  'attempts',
  'checklist',
] as const;

export const DAY_TYPES = [
  'hypertrophy',
  'strength',
  'skill_heavy',
  'skill_light',
  'dynamics',
  'test',
  'conditioning',
  'custom',
] as const;

export const SPLIT_TYPES = [
  'full_body',
  'upper_lower',
  'ppl',
  'ppll',
  'ulu_lul_rotation',
  'calisthenics_cycle',
  'custom',
] as const;

const isHalfStep = (n: number) => Number.isInteger(n * 2);

export const IdSchema = z.string().min(1);
export const DateStrSchema = z.string().refine(isDateStr, 'Expected a yyyy-mm-dd date');
export const EpochMsSchema = z.number().int().nonnegative();
export const MuscleSchema = z.enum(MUSCLES);
export const TrackingTypeSchema = z.enum(TRACKING_TYPES);
export const LoadUnitSchema = z.enum(['total', 'per_hand', 'per_side']);
export const EffortModeSchema = z.enum(['rir', 'rpe', 'off']);
export const DayTypeSchema = z.enum(DAY_TYPES);
export const SplitTypeSchema = z.enum(SPLIT_TYPES);
export const WeekdaySchema = z.enum(WEEKDAYS);
export const SetKindSchema = z.enum(['warmup', 'working']);
export const PartUnitSchema = z.enum(['reps', 'seconds']);

/** Stored effort: 0 to 5 in steps of 0.5, where 5 means 5 or more. Null when not logged. */
export const RirSchema = z
  .number()
  .min(0)
  .max(5)
  .refine(isHalfStep, 'RIR uses steps of 0.5')
  .nullable();

const kg = z.number().nonnegative();
const count = z.number().int().nonnegative();

export const ExerciseSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  trackingType: TrackingTypeSchema,
  primaryMuscles: z.array(MuscleSchema),
  secondaryMuscles: z.array(MuscleSchema),
  unilateral: z.boolean(),
  loadUnit: LoadUnitSchema,
  defaultRestSec: count,
  cues: z.string(),
  alternativeIds: z.array(IdSchema),
  progressionLadder: z.array(z.string().min(1)).optional(),
  effortInput: EffortModeSchema.optional(),
  isCustom: z.boolean(),
  archived: z.boolean(),
});

export const BandSchema = z.object({
  id: IdSchema,
  label: z.string().min(1),
  ratedKg: kg,
  color: z.string().optional(),
  archived: z.boolean().optional(),
});

export const ComplexPartTargetSchema = z.object({
  name: z.string().min(1),
  unit: PartUnitSchema,
  target: count,
});

export const SetTargetSchema = z.object({
  repsMin: count.optional(),
  repsMax: count.optional(),
  secondsMin: count.optional(),
  secondsMax: count.optional(),
  attemptsMin: count.optional(),
  attemptsMax: count.optional(),
  loadMinKg: kg.optional(),
  loadMaxKg: kg.optional(),
  addedKg: kg.optional(),
  bandIds: z.array(IdSchema).optional(),
  /** A ladder label, or "current" for the hardest progression you hold clean. */
  progressionLevel: z.string().min(1).optional(),
  parts: z.array(ComplexPartTargetSchema).optional(),
  isMax: z.boolean().optional(),
  note: z.string().optional(),
});

const setsRangeOk = (v: { setsMin: number; setsMax?: number | undefined }) =>
  v.setsMax === undefined || v.setsMax >= v.setsMin;
const setsRangeMessage = { message: 'setsMax must not be below setsMin', path: ['setsMax'] };

export const ChoiceOptionSchema = z
  .object({
    exerciseId: IdSchema,
    setsMin: z.number().int().min(1),
    setsMax: z.number().int().min(1).optional(),
    target: SetTargetSchema,
    pickWhen: z.string(),
  })
  .refine(setsRangeOk, setsRangeMessage);

export const ChoiceSlotSchema = z.object({
  /** Shared by every block that offers the same choice, so one pick applies to all of them. */
  id: IdSchema,
  label: z.string().min(1),
  options: z.array(ChoiceOptionSchema).min(1),
});

const blockCommon = {
  id: IdSchema,
  order: count,
  setsMin: z.number().int().min(1),
  setsMax: z.number().int().min(1).optional(),
  target: SetTargetSchema,
  restSec: count.optional(),
  supersetGroup: z.string().min(1).optional(),
  warmupSets: count,
  note: z.string().optional(),
};

export const ExerciseBlockSchema = z
  .object({
    ...blockCommon,
    kind: z.literal('exercise'),
    exerciseId: IdSchema,
    /** Set when this block came from resolving a choice slot. */
    fromSlotId: IdSchema.optional(),
    optionIndex: count.optional(),
  })
  .refine(setsRangeOk, setsRangeMessage);

export const ChoiceBlockSchema = z
  .object({
    ...blockCommon,
    kind: z.literal('choice'),
    choiceSlot: ChoiceSlotSchema,
  })
  .refine(setsRangeOk, setsRangeMessage);

export const BlockSchema = z.discriminatedUnion('kind', [ExerciseBlockSchema, ChoiceBlockSchema]);

export const DayTemplateSchema = z.object({
  id: IdSchema,
  programId: IdSchema,
  name: z.string().min(1),
  dayType: DayTypeSchema,
  deloadExempt: z.boolean(),
  note: z.string(),
  blocks: z.array(BlockSchema),
});

export const WeekGridSchema = z.object(
  Object.fromEntries(WEEKDAYS.map((d) => [d, IdSchema.nullable()])) as Record<
    (typeof WEEKDAYS)[number],
    z.ZodNullable<typeof IdSchema>
  >,
);

export const WeekdayScheduleSchema = z.object({
  kind: z.literal('weekday'),
  weeks: z.array(WeekGridSchema).min(1),
});

export const RotationScheduleSchema = z.object({
  kind: z.literal('rotation'),
  sequence: z.array(IdSchema).min(1),
  sessionsPerWeek: z.number().int().min(1).max(7),
  preferredWeekdays: z.array(WeekdaySchema).optional(),
});

export const ScheduleSchema = z.discriminatedUnion('kind', [
  WeekdayScheduleSchema,
  RotationScheduleSchema,
]);

export const ChoiceSelectionSchema = z.object({
  cycleNumber: z.number().int(),
  slotId: IdSchema,
  optionIndex: count,
});

export const ProgramSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    splitType: SplitTypeSchema,
    schedule: ScheduleSchema,
    /** Required for weekday grids, optional for rotations (only used for deloads). */
    cycleWeeks: z.number().int().min(1).nullable(),
    deloadWeeks: z.array(z.number().int().min(1)),
    /** Monday of week 1 of cycle 1. Null until the program is activated. */
    anchorDate: DateStrSchema.nullable(),
    choiceSelections: z.array(ChoiceSelectionSchema),
    /** Monday of each week deloaded by hand. */
    manualDeloadWeeks: z.array(DateStrSchema),
    note: z.string(),
    active: z.boolean(),
    archived: z.boolean(),
    /** In the coach profile: the client the program is for. */
    clientId: IdSchema.nullable().optional(),
    /** In the coach profile: when it was last sent, and the share code that was sent. */
    sentAt: EpochMsSchema.nullable().optional(),
    sentCode: z.string().optional(),
  })
  .refine((p) => p.schedule.kind !== 'weekday' || p.schedule.weeks.length === p.cycleWeeks, {
    message: 'A weekday grid needs one week per cycle week',
    path: ['schedule'],
  })
  .refine((p) => p.deloadWeeks.every((w) => p.cycleWeeks !== null && w <= p.cycleWeeks), {
    message: 'Deload weeks must be inside the cycle',
    path: ['deloadWeeks'],
  });

export const PlanSnapshotSchema = z.object({
  dayTemplateId: IdSchema.nullable(),
  name: z.string(),
  dayType: DayTypeSchema,
  note: z.string(),
  isDeload: z.boolean(),
  cycleNumber: z.number().int().nullable(),
  cycleWeek: z.number().int().nullable(),
  blocks: z.array(BlockSchema),
});

export const SessionSchema = z.object({
  id: IdSchema,
  programId: IdSchema.nullable(),
  dayTemplateId: IdSchema.nullable(),
  cycleNumber: z.number().int().nullable(),
  cycleWeek: z.number().int().nullable(),
  rotationIndex: count.nullable(),
  name: z.string(),
  dayType: DayTypeSchema,
  isDeload: z.boolean(),
  /** Local calendar day the session started on. */
  date: DateStrSchema,
  startedAt: EpochMsSchema,
  finishedAt: EpochMsSchema.nullable(),
  status: z.enum(['active', 'finished']),
  notes: z.string(),
  planSnapshot: PlanSnapshotSchema.nullable(),
});

export const SessionExerciseSchema = z.object({
  id: IdSchema,
  sessionId: IdSchema,
  exerciseId: IdSchema,
  order: count,
  blockId: IdSchema.nullable(),
  swappedFromExerciseId: IdSchema.nullable(),
  note: z.string(),
});

export const LoggedPartSchema = z.object({
  name: z.string().min(1),
  unit: PartUnitSchema,
  value: count,
});

export const LoggedSetSchema = z.object({
  id: IdSchema,
  sessionId: IdSchema,
  sessionExerciseId: IdSchema,
  exerciseId: IdSchema,
  order: count,
  kind: SetKindSchema,
  target: SetTargetSchema.optional(),
  kg: kg.optional(),
  addedKg: kg.optional(),
  bandIds: z.array(IdSchema).optional(),
  reps: count.optional(),
  seconds: z.number().nonnegative().optional(),
  progressionLevel: z.string().min(1).optional(),
  parts: z.array(LoggedPartSchema).optional(),
  attempts: count.optional(),
  cleanAttempts: count.optional(),
  rir: RirSchema,
  clean: z.boolean().optional(),
  done: z.boolean(),
  completedAt: EpochMsSchema.nullable(),
  note: z.string().optional(),
});

export const BodyweightEntrySchema = z.object({
  /** One entry per local day, last write wins. */
  date: DateStrSchema,
  kg: z.number().positive(),
});

export const TestResultSchema = z.object({
  id: IdSchema,
  sessionId: IdSchema,
  date: DateStrSchema,
  exerciseId: IdSchema,
  progressionLevel: z.string().min(1).nullable(),
  bestHoldSec: z.number().nonnegative().nullable(),
  note: z.string(),
  nextCycleChoice: z.object({ slotId: IdSchema, optionIndex: count }).nullable(),
});

export const PROFILES = ['me', 'coach'] as const;
export const ProfileSchema = z.enum(PROFILES);

/** A person the coach writes programs for. Only the coach profile has clients. */
export const ClientSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  note: z.string(),
  createdAt: EpochMsSchema,
  archived: z.boolean(),
});

export const MISSED_REASONS = ['sick', 'busy', 'pain', 'travel', 'other'] as const;
export const MissedReasonSchema = z.enum(MISSED_REASONS);

/** A planned day the user said they would not train. It is skipped, never moved. */
export const MissedDaySchema = z.object({
  id: IdSchema,
  programId: IdSchema,
  date: DateStrSchema,
  dayTemplateId: IdSchema,
  /** Kept so the record still reads right after the program is edited or deleted. */
  dayName: z.string().min(1),
  /** The rotation position it skipped. Null for weekday programs. */
  rotationIndex: count.nullable(),
  reason: MissedReasonSchema.nullable(),
  note: z.string(),
  createdAt: EpochMsSchema,
});

export const RestTimerSchema = z.object({
  id: z.literal('current'),
  sessionId: IdSchema,
  startedAt: EpochMsSchema,
  endsAt: EpochMsSchema,
  durationSec: count,
});

export const AppSettingsSchema = z.object({
  effortMode: EffortModeSchema,
  sound: z.boolean(),
  keepAwake: z.boolean(),
  backupReminderDays: z.number().int().min(1),
  muscleReference: z.object({ min: z.number().nonnegative(), max: z.number().nonnegative() }),
  lastBackupAt: EpochMsSchema.nullable(),
  /** The tip about the screen sleeping, shown once where Wake Lock is missing. */
  wakeLockTipShown: z.boolean(),
});

export const SettingRowSchema = z.object({ key: z.string().min(1), value: z.unknown() });

export type Muscle = z.infer<typeof MuscleSchema>;
export type TrackingType = z.infer<typeof TrackingTypeSchema>;
export type LoadUnit = z.infer<typeof LoadUnitSchema>;
export type EffortMode = z.infer<typeof EffortModeSchema>;
export type DayType = z.infer<typeof DayTypeSchema>;
export type SplitType = z.infer<typeof SplitTypeSchema>;
export type Exercise = z.infer<typeof ExerciseSchema>;
export type Band = z.infer<typeof BandSchema>;
export type ComplexPartTarget = z.infer<typeof ComplexPartTargetSchema>;
export type SetTarget = z.infer<typeof SetTargetSchema>;
export type ChoiceOption = z.infer<typeof ChoiceOptionSchema>;
export type ChoiceSlot = z.infer<typeof ChoiceSlotSchema>;
export type ExerciseBlock = z.infer<typeof ExerciseBlockSchema>;
export type ChoiceBlock = z.infer<typeof ChoiceBlockSchema>;
export type Block = z.infer<typeof BlockSchema>;
export type DayTemplate = z.infer<typeof DayTemplateSchema>;
export type WeekGrid = z.infer<typeof WeekGridSchema>;
export type WeekdaySchedule = z.infer<typeof WeekdayScheduleSchema>;
export type RotationSchedule = z.infer<typeof RotationScheduleSchema>;
export type Schedule = z.infer<typeof ScheduleSchema>;
export type ChoiceSelection = z.infer<typeof ChoiceSelectionSchema>;
export type Program = z.infer<typeof ProgramSchema>;
export type PlanSnapshot = z.infer<typeof PlanSnapshotSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type SessionExercise = z.infer<typeof SessionExerciseSchema>;
export type LoggedPart = z.infer<typeof LoggedPartSchema>;
export type LoggedSet = z.infer<typeof LoggedSetSchema>;
export type MissedReason = z.infer<typeof MissedReasonSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type Client = z.infer<typeof ClientSchema>;
export type MissedDay = z.infer<typeof MissedDaySchema>;
export type BodyweightEntry = z.infer<typeof BodyweightEntrySchema>;
export type TestResult = z.infer<typeof TestResultSchema>;
export type RestTimer = z.infer<typeof RestTimerSchema>;
export type AppSettings = z.infer<typeof AppSettingsSchema>;
export type SettingRow = z.infer<typeof SettingRowSchema>;

export const DEFAULT_SETTINGS: AppSettings = {
  effortMode: 'rir',
  sound: true,
  keepAwake: true,
  backupReminderDays: 14,
  muscleReference: { min: 10, max: 20 },
  lastBackupAt: null,
  wakeLockTipShown: false,
};

export type ValidationResult = { ok: true } | { ok: false; error: string };

/** Rules that need the exercise to check a logged set. */
export function validateSetForExercise(set: LoggedSet, exercise: Exercise): ValidationResult {
  if (
    exercise.trackingType === 'bodyweight_reps' &&
    (set.addedKg ?? 0) > 0 &&
    (set.bandIds?.length ?? 0) > 0
  ) {
    return { ok: false, error: 'Use added weight or bands, not both.' };
  }
  return { ok: true };
}
