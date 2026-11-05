import { todayPlan, type TodayPlan } from '../domain/today';
import type { BodyweightEntry, DayTemplate, Program } from '../domain/schemas';
import type { DataContext } from './context';
import { getActiveProgram, getProgram } from './programs';
import { getActiveSession, type SessionView } from './sessions';

export type TodayOverview = {
  active: SessionView | null;
  program: Program | null;
  days: DayTemplate[];
  plan: TodayPlan | null;
  bodyweight: BodyweightEntry | null;
};

/** Everything the Today tab shows, read together so it updates as one. */
export async function getTodayOverview(ctx: DataContext): Promise<TodayOverview> {
  const today = ctx.clock.today();
  const [active, program, bodyweight] = await Promise.all([
    getActiveSession(ctx),
    getActiveProgram(ctx),
    ctx.db.bodyweight.get(today),
  ]);
  const base = { active, bodyweight: bodyweight ?? null };
  if (!program) return { ...base, program: null, days: [], plan: null };
  const [loaded, sessions] = await Promise.all([
    getProgram(ctx, program.id),
    ctx.db.sessions.where('programId').equals(program.id).toArray(),
  ]);
  return {
    ...base,
    program,
    days: loaded?.dayTemplates ?? [],
    plan: todayPlan({ program, sessions, today }),
  };
}
