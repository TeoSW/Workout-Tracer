import type {
  AppSettings,
  Band,
  BodyweightEntry,
  Exercise,
  LoggedSet,
  Program,
  Session,
  TestResult,
} from '../domain/schemas';
import { loadBandMap } from './bands';
import type { DataContext } from './context';
import { loadExerciseMap } from './exercises';
import { getActiveProgram } from './programs';
import { getSettings } from './settings';

export type StatsData = {
  sessions: Session[];
  sets: LoggedSet[];
  exercisesById: Map<string, Exercise>;
  bandsById: Map<string, Band>;
  bodyweight: BodyweightEntry[];
  testResults: TestResult[];
  program: Program | null;
  settings: AppSettings;
};

/** Everything Progress reads, together so that it updates as one. Pure functions do the rest. */
export async function loadStatsData(ctx: DataContext): Promise<StatsData> {
  const [sessions, sets, exercisesById, bandsById, bodyweight, testResults, program, settings] =
    await Promise.all([
      ctx.db.sessions.where('status').equals('finished').toArray(),
      ctx.db.sets.toArray(),
      loadExerciseMap(ctx),
      loadBandMap(ctx),
      ctx.db.bodyweight.toArray(),
      ctx.db.testResults.toArray(),
      getActiveProgram(ctx),
      getSettings(ctx),
    ]);
  const finished = new Set(sessions.map((s) => s.id));
  return {
    sessions,
    sets: sets.filter((s) => finished.has(s.sessionId)),
    exercisesById,
    bandsById,
    bodyweight,
    testResults,
    program: program ?? null,
    settings,
  };
}

export type ExerciseStats = {
  sessions: Session[];
  sets: LoggedSet[];
  bandsById: Map<string, Band>;
  bodyweight: BodyweightEntry[];
};

/** What one exercise page reads, which is far less than all of Progress. */
export async function loadExerciseStats(
  ctx: DataContext,
  exerciseId: string,
): Promise<ExerciseStats> {
  const [allSets, bandsById, bodyweight] = await Promise.all([
    ctx.db.sets.where('exerciseId').equals(exerciseId).toArray(),
    loadBandMap(ctx),
    ctx.db.bodyweight.toArray(),
  ]);
  const ids = [...new Set(allSets.map((s) => s.sessionId))];
  const sessions = (await ctx.db.sessions.bulkGet(ids)).filter(
    (s): s is Session => s !== undefined && s.status === 'finished',
  );
  const finished = new Set(sessions.map((s) => s.id));
  return {
    sessions,
    sets: allSets.filter((s) => finished.has(s.sessionId)),
    bandsById,
    bodyweight,
  };
}
