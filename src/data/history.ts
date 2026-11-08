import { monthRange, type MonthStr } from '../domain/calendar';
import type { DateStr } from '../domain/dates';
import type { Session } from '../domain/schemas';
import type { DataContext } from './context';

export async function sessionsInMonth(ctx: DataContext, month: MonthStr): Promise<Session[]> {
  const { from, to } = monthRange(month);
  const sessions = await ctx.db.sessions.where('date').between(from, to, true, true).toArray();
  return sessions.filter((s) => s.status === 'finished');
}

export async function hasFinishedSession(ctx: DataContext): Promise<boolean> {
  return (await ctx.db.sessions.where('status').equals('finished').first()) !== undefined;
}

export async function firstFinishedDate(ctx: DataContext): Promise<DateStr | null> {
  const first = await ctx.db.sessions
    .orderBy('date')
    .filter((s) => s.status === 'finished')
    .first();
  return first?.date ?? null;
}
