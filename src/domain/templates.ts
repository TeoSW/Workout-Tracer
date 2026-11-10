import type { BuiltInTemplate } from './fixtures/templates/types';
import type { Block, DayTemplate, Program, Schedule, SetTarget, SplitType } from './schemas';

export type NewId = () => string;

/** The parts of a program that a template, a share file or a copy carries. */
export type ProgramStructure = {
  name: string;
  splitType: SplitType;
  schedule: Schedule;
  cycleWeeks: number | null;
  deloadWeeks: number[];
  note: string;
  dayTemplates: readonly DayTemplate[];
};

export type CopyOptions = {
  newId: NewId;
  name?: string;
  /** Maps an exercise id from the source to the id to use in the copy. Identity by default. */
  mapExerciseId?: (id: string) => string;
  /** Maps band ids from the source. Unknown bands may be dropped. Identity by default. */
  mapBandIds?: (ids: readonly string[]) => string[];
};

/**
 * Copies a program structure with fresh ids for the program, its days, blocks and choice slots.
 * Choice slots shared between days stay shared. The source is never changed. The copy is not
 * activated and carries no per-user state.
 */
export function copyProgramStructure(
  source: ProgramStructure,
  opts: CopyOptions,
): { program: Program; dayTemplates: DayTemplate[] } {
  const mapExercise = opts.mapExerciseId ?? ((id: string) => id);
  const mapBands = opts.mapBandIds ?? ((ids: readonly string[]) => [...ids]);
  const programId = opts.newId();
  const dayIds = new Map(source.dayTemplates.map((d) => [d.id, opts.newId()]));
  const slotIds = new Map<string, string>();
  const slotId = (old: string) => {
    let id = slotIds.get(old);
    if (id === undefined) {
      id = opts.newId();
      slotIds.set(old, id);
    }
    return id;
  };
  const dayId = (old: string) => {
    const id = dayIds.get(old);
    if (id === undefined) throw new Error(`Schedule points at unknown day ${old}`);
    return id;
  };
  const copyTarget = (target: SetTarget): SetTarget => {
    const copy = structuredClone(target);
    if (copy.bandIds) copy.bandIds = mapBands(copy.bandIds);
    return copy;
  };

  const copyBlock = (block: Block): Block => {
    if (block.kind === 'exercise') {
      return {
        ...structuredClone(block),
        id: opts.newId(),
        exerciseId: mapExercise(block.exerciseId),
        target: copyTarget(block.target),
      };
    }
    return {
      ...structuredClone(block),
      id: opts.newId(),
      target: copyTarget(block.target),
      choiceSlot: {
        ...structuredClone(block.choiceSlot),
        id: slotId(block.choiceSlot.id),
        options: block.choiceSlot.options.map((o) => ({
          ...structuredClone(o),
          exerciseId: mapExercise(o.exerciseId),
          target: copyTarget(o.target),
        })),
      },
    };
  };

  const dayTemplates = source.dayTemplates.map((d) => ({
    ...structuredClone(d),
    id: dayId(d.id),
    programId,
    blocks: d.blocks.map(copyBlock),
  }));

  const schedule: Schedule =
    source.schedule.kind === 'rotation'
      ? { ...structuredClone(source.schedule), sequence: source.schedule.sequence.map(dayId) }
      : {
          kind: 'weekday',
          weeks: source.schedule.weeks.map((w) => {
            const copy = { ...w };
            for (const key of Object.keys(copy) as (keyof typeof copy)[]) {
              const value = copy[key];
              copy[key] = value === null ? null : dayId(value);
            }
            return copy;
          }),
        };

  return {
    program: {
      id: programId,
      name: opts.name ?? source.name,
      splitType: source.splitType,
      schedule,
      cycleWeeks: source.cycleWeeks,
      deloadWeeks: [...source.deloadWeeks],
      anchorDate: null,
      choiceSelections: [],
      manualDeloadWeeks: [],
      note: source.note,
      active: false,
      archived: false,
    },
    dayTemplates,
  };
}

/** Copies a built-in template into a user program. The template itself is never changed. */
export function instantiateTemplate(
  template: BuiltInTemplate,
  opts: Pick<CopyOptions, 'newId' | 'name' | 'mapExerciseId'>,
): { program: Program; dayTemplates: DayTemplate[] } {
  return copyProgramStructure(template, opts);
}
