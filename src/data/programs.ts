import { addDays, mondayOf, WEEKDAYS } from '../domain/dates';
import { addManualDeloadWeek, removeManualDeloadWeek } from '../domain/deload';
import type { BuiltInTemplate } from '../domain/fixtures/templates';
import { setCurrentWeek } from '../domain/schedule';
import {
  DayTemplateSchema,
  ProgramSchema,
  type DayTemplate,
  type DayType,
  type Program,
  type Schedule,
} from '../domain/schemas';
import { instantiateTemplate } from '../domain/templates';
import { clean } from './clean';
import type { DataContext } from './context';

export type ProgramWithDays = { program: Program; dayTemplates: DayTemplate[] };

function scheduledDayIds(schedule: Schedule): string[] {
  return schedule.kind === 'rotation'
    ? schedule.sequence
    : schedule.weeks.flatMap((w) => WEEKDAYS.map((d) => w[d]).filter((id) => id !== null));
}

/** Days in the order the schedule first uses them, then unscheduled days by name. */
function sortDays(program: Program, days: DayTemplate[]): DayTemplate[] {
  const position = new Map<string, number>();
  scheduledDayIds(program.schedule).forEach((id, i) => {
    if (!position.has(id)) position.set(id, i);
  });
  return [...days].sort((a, b) => {
    const pa = position.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const pb = position.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return pa - pb || a.name.localeCompare(b.name);
  });
}

function validProgram(program: Program, dayIds: ReadonlySet<string>): Program {
  const parsed = ProgramSchema.parse(clean(program));
  if (scheduledDayIds(parsed.schedule).some((id) => !dayIds.has(id))) {
    throw new Error('The schedule points at a day that is not in this program.');
  }
  return parsed;
}

async function dayIdsOf(ctx: DataContext, programId: string): Promise<Set<string>> {
  return new Set(
    (await ctx.db.dayTemplates.where('programId').equals(programId).primaryKeys()) as string[],
  );
}

async function requireProgram(ctx: DataContext, id: string): Promise<Program> {
  const program = await ctx.db.programs.get(id);
  if (!program) throw new Error(`No program ${id}`);
  return program;
}

export async function createProgramFromTemplate(
  ctx: DataContext,
  template: BuiltInTemplate,
  name?: string,
): Promise<ProgramWithDays> {
  const { program, dayTemplates } = instantiateTemplate(template, {
    newId: ctx.newId,
    ...(name === undefined ? {} : { name }),
  });
  const days = dayTemplates.map((d) => DayTemplateSchema.parse(clean(d)));
  const saved = validProgram(program, new Set(days.map((d) => d.id)));
  await ctx.db.transaction('rw', [ctx.db.programs, ctx.db.dayTemplates], async () => {
    await ctx.db.programs.add(saved);
    await ctx.db.dayTemplates.bulkAdd(days);
  });
  return { program: saved, dayTemplates: sortDays(saved, days) };
}

/** Active program first, then by name. */
export async function listPrograms(
  ctx: DataContext,
  opts: { includeArchived?: boolean } = {},
): Promise<Program[]> {
  const all = await ctx.db.programs.toArray();
  return all
    .filter((p) => opts.includeArchived || !p.archived)
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
}

export async function getProgram(
  ctx: DataContext,
  id: string,
): Promise<ProgramWithDays | undefined> {
  const program = await ctx.db.programs.get(id);
  if (!program) return undefined;
  const days = await ctx.db.dayTemplates.where('programId').equals(id).toArray();
  return { program, dayTemplates: sortDays(program, days) };
}

export async function getActiveProgram(ctx: DataContext): Promise<Program | undefined> {
  return ctx.db.programs.filter((p) => p.active).first();
}

/**
 * Makes a program the only active one. Its cycle starts on the Monday of this week or of next
 * week, as the user picks.
 */
export async function activateProgram(
  ctx: DataContext,
  id: string,
  start: 'this_week' | 'next_week',
): Promise<Program> {
  return ctx.db.transaction('rw', ctx.db.programs, async () => {
    const program = await requireProgram(ctx, id);
    const monday = mondayOf(ctx.clock.today());
    const anchorDate = start === 'this_week' ? monday : addDays(monday, 7);
    const others = await ctx.db.programs.filter((p) => p.active && p.id !== id).toArray();
    for (const other of others) await ctx.db.programs.put({ ...other, active: false });
    const activated = ProgramSchema.parse(
      clean({ ...program, active: true, archived: false, anchorDate }),
    );
    await ctx.db.programs.put(activated);
    return activated;
  });
}

export async function deactivateProgram(ctx: DataContext, id: string): Promise<void> {
  await ctx.db.programs.update(id, { active: false });
}

export async function updateProgram(ctx: DataContext, program: Program): Promise<Program> {
  return ctx.db.transaction('rw', [ctx.db.programs, ctx.db.dayTemplates], async () => {
    await requireProgram(ctx, program.id);
    const saved = validProgram(program, await dayIdsOf(ctx, program.id));
    await ctx.db.programs.put(saved);
    return saved;
  });
}

async function editProgram(
  ctx: DataContext,
  id: string,
  change: (program: Program) => Program,
): Promise<Program> {
  return ctx.db.transaction('rw', [ctx.db.programs, ctx.db.dayTemplates], async () => {
    const saved = validProgram(change(await requireProgram(ctx, id)), await dayIdsOf(ctx, id));
    await ctx.db.programs.put(saved);
    return saved;
  });
}

export function setProgramCurrentWeek(
  ctx: DataContext,
  id: string,
  week: number,
): Promise<Program> {
  return editProgram(ctx, id, (p) => ({
    ...p,
    anchorDate: setCurrentWeek(p, ctx.clock.today(), week),
  }));
}

export function setDeloadThisWeek(ctx: DataContext, id: string): Promise<Program> {
  return editProgram(ctx, id, (p) => addManualDeloadWeek(p, ctx.clock.today()));
}

export function removeDeloadThisWeek(ctx: DataContext, id: string): Promise<Program> {
  return editProgram(ctx, id, (p) => removeManualDeloadWeek(p, ctx.clock.today()));
}

export async function addDayTemplate(
  ctx: DataContext,
  programId: string,
  input: { name: string; dayType: DayType },
): Promise<DayTemplate> {
  const day = DayTemplateSchema.parse({
    id: ctx.newId(),
    programId,
    name: input.name,
    dayType: input.dayType,
    deloadExempt: false,
    note: '',
    blocks: [],
  });
  await ctx.db.transaction('rw', [ctx.db.programs, ctx.db.dayTemplates], async () => {
    await requireProgram(ctx, programId);
    await ctx.db.dayTemplates.add(day);
  });
  return day;
}

export async function saveDayTemplate(ctx: DataContext, day: DayTemplate): Promise<DayTemplate> {
  const parsed = DayTemplateSchema.parse(clean(day));
  return ctx.db.transaction('rw', [ctx.db.programs, ctx.db.dayTemplates], async () => {
    await requireProgram(ctx, parsed.programId);
    const existing = await ctx.db.dayTemplates.get(parsed.id);
    if (existing && existing.programId !== parsed.programId) {
      throw new Error('A day cannot move to another program.');
    }
    await ctx.db.dayTemplates.put(parsed);
    return parsed;
  });
}

/** Deletes a day and takes it out of the schedule. Past sessions keep their own copy. */
export async function deleteDayTemplate(ctx: DataContext, id: string): Promise<void> {
  await ctx.db.transaction('rw', [ctx.db.programs, ctx.db.dayTemplates], async () => {
    const day = await ctx.db.dayTemplates.get(id);
    if (!day) return;
    const program = await requireProgram(ctx, day.programId);
    let schedule: Schedule;
    if (program.schedule.kind === 'rotation') {
      const sequence = program.schedule.sequence.filter((d) => d !== id);
      if (sequence.length === 0) throw new Error('A rotation needs at least one day.');
      schedule = { ...program.schedule, sequence };
    } else {
      schedule = {
        kind: 'weekday',
        weeks: program.schedule.weeks.map((w) => {
          const copy = { ...w };
          for (const d of WEEKDAYS) if (copy[d] === id) copy[d] = null;
          return copy;
        }),
      };
    }
    await ctx.db.dayTemplates.delete(id);
    const ids = await dayIdsOf(ctx, program.id);
    await ctx.db.programs.put(validProgram({ ...program, schedule }, ids));
  });
}

export async function archiveProgram(ctx: DataContext, id: string): Promise<void> {
  await editProgram(ctx, id, (p) => ({ ...p, archived: true, active: false }));
}

/** Deletes a program and its days. Sessions logged with it keep their plan snapshots. */
export async function deleteProgram(ctx: DataContext, id: string): Promise<void> {
  await ctx.db.transaction('rw', [ctx.db.programs, ctx.db.dayTemplates], async () => {
    await ctx.db.dayTemplates.where('programId').equals(id).delete();
    await ctx.db.programs.delete(id);
  });
}
