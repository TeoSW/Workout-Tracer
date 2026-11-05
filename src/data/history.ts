import { monthRange, type MonthStr } from '../domain/calendar';
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
