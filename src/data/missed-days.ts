import { MissedDaySchema, type MissedDay, type MissedReason } from '../domain/schemas';
import { clean } from './clean';
import type { DataContext } from './context';
import { getTodayOverview } from './today';

/**
 * Marks today's planned day of the active program as missed. A weekday grid keeps its calendar,
 * and a rotation moves past the day.
 */
export async function markDayMissed(
  ctx: DataContext,
  input: { reason: MissedReason | null; note: string },
): Promise<MissedDay> {
  const { program, plan, days } = await getTodayOverview(ctx);
  if (!program || plan?.today.status !== 'planned') throw new Error('Nothing is planned today.');
  const { day } = plan.today;
  const record = MissedDaySchema.parse(
    clean({
      id: ctx.newId(),
      programId: program.id,
      date: ctx.clock.today(),
      dayTemplateId: day.dayTemplateId,
      dayName: days.find((d) => d.id === day.dayTemplateId)?.name ?? 'Workout',
      rotationIndex: day.rotationIndex,
      reason: input.reason,
      note: input.note.trim(),
      createdAt: ctx.clock.now(),
    }),
  );
  await ctx.db.missedDays.add(record);
  return record;
}

export async function undoMissedDay(ctx: DataContext, id: string): Promise<void> {
  await ctx.db.missedDays.delete(id);
}

/** Every missed day, newest first. */
export async function listMissedDays(ctx: DataContext): Promise<MissedDay[]> {
  const all = await ctx.db.missedDays.toArray();
  return all.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}
