import type {
  Block,
  ChoiceOption,
  ComplexPartTarget,
  DayTemplate,
  DayType,
  SetPlan,
  SetTarget,
  WeekGrid,
} from '../schemas';

/** Helpers that keep the templates close to the tables in spec section 9. */

export const reps = (min: number, max?: number): SetTarget =>
  max === undefined ? { repsMin: min } : { repsMin: min, repsMax: max };

export const secs = (min: number, max?: number): SetTarget =>
  max === undefined ? { secondsMin: min } : { secondsMin: min, secondsMax: max };

export const attempts = (min: number, max: number): SetTarget => ({
  attemptsMin: min,
  attemptsMax: max,
});

export const kg = (min: number, max?: number): SetTarget =>
  max === undefined ? { loadMinKg: min } : { loadMinKg: min, loadMaxKg: max };

export const added = (addedKg: number): SetTarget => ({ addedKg });

/** A planned RPE, stored as RIR. */
export const rpe = (value: number): SetTarget => ({ rir: 10 - value });

export const bands = (...bandIds: string[]): SetTarget => ({ bandIds });

export const holdPart = (name: string, target: number): ComplexPartTarget => ({
  name,
  unit: 'seconds',
  target,
});

export const repPart = (name: string, target: number): ComplexPartTarget => ({
  name,
  unit: 'reps',
  target,
});

type Sets = number | [number, number];

type BlockExtras = {
  note?: string;
  restSec?: number;
  supersetGroup?: string;
  warmupSets?: number;
  setTargets?: SetPlan[];
};

export type BlockInput =
  | ({ kind: 'exercise'; exerciseId: string; sets: Sets; target: SetTarget } & BlockExtras)
  | ({
      kind: 'choice';
      slotId: string;
      label: string;
      sets: Sets;
      options: ChoiceOption[];
    } & BlockExtras);

export function ex(
  exerciseId: string,
  sets: Sets,
  target: SetTarget = {},
  extras: BlockExtras = {},
): BlockInput {
  return { kind: 'exercise', exerciseId, sets, target, ...extras };
}

export function choice(
  slotId: string,
  label: string,
  sets: Sets,
  options: ChoiceOption[],
  extras: BlockExtras = {},
): BlockInput {
  return { kind: 'choice', slotId, label, sets, options, ...extras };
}

export function option(
  exerciseId: string,
  sets: Sets,
  target: SetTarget,
  pickWhen: string,
): ChoiceOption {
  return { exerciseId, ...setsRange(sets), target, pickWhen };
}

function setsRange(sets: Sets): { setsMin: number; setsMax?: number } {
  return typeof sets === 'number' ? { setsMin: sets } : { setsMin: sets[0], setsMax: sets[1] };
}

function toBlock(input: BlockInput, id: string, order: number): Block {
  const common = {
    id,
    order,
    ...setsRange(input.sets),
    warmupSets: input.warmupSets ?? 0,
    ...(input.note === undefined ? {} : { note: input.note }),
    ...(input.restSec === undefined ? {} : { restSec: input.restSec }),
    ...(input.supersetGroup === undefined ? {} : { supersetGroup: input.supersetGroup }),
    ...(input.setTargets === undefined ? {} : { setTargets: input.setTargets }),
  };
  if (input.kind === 'exercise') {
    return { ...common, kind: 'exercise', exerciseId: input.exerciseId, target: input.target };
  }
  return {
    ...common,
    kind: 'choice',
    target: {},
    choiceSlot: { id: input.slotId, label: input.label, options: input.options },
  };
}

export function dayTemplate(
  programId: string,
  id: string,
  name: string,
  dayType: DayType,
  blocks: BlockInput[],
  opts: { note?: string; deloadExempt?: boolean } = {},
): DayTemplate {
  return {
    id,
    programId,
    name,
    dayType,
    deloadExempt: opts.deloadExempt ?? false,
    note: opts.note ?? '',
    blocks: blocks.map((b, i) => toBlock(b, `${id}-${i + 1}`, i)),
  };
}

export const REST_WEEK: WeekGrid = {
  mon: null,
  tue: null,
  wed: null,
  thu: null,
  fri: null,
  sat: null,
  sun: null,
};

export function week(days: Partial<WeekGrid>): WeekGrid {
  return { ...REST_WEEK, ...days };
}
