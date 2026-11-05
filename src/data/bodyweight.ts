import type { DateStr } from '../domain/dates';
import { BodyweightEntrySchema, type BodyweightEntry } from '../domain/schemas';
import type { DataContext } from './context';

/** One entry per local day. Writing a day again replaces it. */
export async function setBodyweight(ctx: DataContext, date: DateStr, kg: number): Promise<void> {
  await ctx.db.bodyweight.put(BodyweightEntrySchema.parse({ date, kg }));
}

export async function deleteBodyweight(ctx: DataContext, date: DateStr): Promise<void> {
  await ctx.db.bodyweight.delete(date);
}

/** Oldest first. */
export async function listBodyweight(ctx: DataContext): Promise<BodyweightEntry[]> {
  return ctx.db.bodyweight.orderBy('date').toArray();
}
