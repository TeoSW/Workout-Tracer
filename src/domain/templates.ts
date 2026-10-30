import type { BuiltInTemplate } from './fixtures/templates/types';
import type { Block, DayTemplate, Program, Schedule } from './schemas';

export type NewId = () => string;

/**
 * Copies a built-in template into a user program with fresh ids. The template itself is never
 * changed. Choice slots shared between days stay shared in the copy.
 */
export function instantiateTemplate(
  template: BuiltInTemplate,
  opts: { newId: NewId; name?: string },
): { program: Program; dayTemplates: DayTemplate[] } {
  const programId = opts.newId();
  const dayIds = new Map(template.dayTemplates.map((d) => [d.id, opts.newId()]));
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
    if (id === undefined) throw new Error(`Template ${template.id} points at unknown day ${old}`);
    return id;
  };

  const copyBlock = (block: Block): Block => {
    const copy = structuredClone(block);
    copy.id = opts.newId();
    if (copy.kind === 'choice') copy.choiceSlot.id = slotId(copy.choiceSlot.id);
    return copy;
  };

  const dayTemplates = template.dayTemplates.map((d) => ({
    ...structuredClone(d),
    id: dayId(d.id),
    programId,
    blocks: d.blocks.map(copyBlock),
  }));

  const schedule: Schedule =
    template.schedule.kind === 'rotation'
      ? { ...structuredClone(template.schedule), sequence: template.schedule.sequence.map(dayId) }
      : {
          kind: 'weekday',
          weeks: template.schedule.weeks.map((w) => {
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
      name: opts.name ?? template.name,
      splitType: template.splitType,
      schedule,
      cycleWeeks: template.cycleWeeks,
      deloadWeeks: [...template.deloadWeeks],
      anchorDate: null,
      choiceSelections: [],
      manualDeloadWeeks: [],
      note: template.note,
      active: false,
      archived: false,
    },
    dayTemplates,
  };
}
