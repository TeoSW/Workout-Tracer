import type {
  AppSettings,
  Band,
  BodyweightEntry,
  Exercise,
  LoggedSet,
  MissedDay,
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
  missedDays: MissedDay[];
};

/** Everything Progress reads, together so that it updates as one. Pure functions do the rest. */
export async function loadStatsData(ctx: DataContext): Promise<StatsData> {
  const [
    sessions,
    sets,
    exercisesById,
    bandsById,
    bodyweight,
    testResults,
    program,
    settings,
    missedDays,
  ] = await Promise.all([
    ctx.db.sessions.where('status').equals('finished').toArray(),
    ctx.db.sets.toArray(),
    loadExerciseMap(ctx),
    loadBandMap(ctx),
    ctx.db.bodyweight.toArray(),
    ctx.db.testResults.toArray(),
    getActiveProgram(ctx),
    getSettings(ctx),
    ctx.db.missedDays.toArray(),
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
    missedDays,
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

/** Exercises with a done set in a finished session, by name. */
export async function listLoggedExercises(ctx: DataContext): Promise<Exercise[]> {
  const [sets, sessions, exercises] = await Promise.all([
    ctx.db.sets.toArray(),
    ctx.db.sessions.where('status').equals('finished').primaryKeys(),
    loadExerciseMap(ctx),
  ]);
  const finished = new Set(sessions);
  const logged = new Set(
    sets.filter((s) => s.done && finished.has(s.sessionId)).map((s) => s.exerciseId),
  );
  return [...logged]
    .flatMap((id) => exercises.get(id) ?? [])
    .sort((a, b) => a.name.localeCompare(b.name));
}
