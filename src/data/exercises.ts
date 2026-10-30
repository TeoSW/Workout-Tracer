import { ExerciseSchema, type Exercise } from '../domain/schemas';
import { clean } from './clean';
import type { DataContext } from './context';

export type NewExercise = Omit<Exercise, 'id' | 'isCustom' | 'archived'>;

const nameKey = (name: string) => name.trim().toLowerCase();

export async function listExercises(
  ctx: DataContext,
  opts: { includeArchived?: boolean } = {},
): Promise<Exercise[]> {
  const all = await ctx.db.exercises.toArray();
  return all
    .filter((e) => opts.includeArchived || !e.archived)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadExerciseMap(ctx: DataContext): Promise<Map<string, Exercise>> {
  return new Map((await ctx.db.exercises.toArray()).map((e) => [e.id, e]));
}

export async function getExercise(ctx: DataContext, id: string): Promise<Exercise | undefined> {
  return ctx.db.exercises.get(id);
}

async function assertNameFree(ctx: DataContext, name: string, exceptId?: string): Promise<void> {
  const key = nameKey(name);
  const clash = await ctx.db.exercises
    .filter((e) => !e.archived && e.id !== exceptId && nameKey(e.name) === key)
    .first();
  if (clash) throw new Error('An exercise with this name already exists.');
}

export async function addCustomExercise(ctx: DataContext, input: NewExercise): Promise<Exercise> {
  return ctx.db.transaction('rw', ctx.db.exercises, async () => {
    const exercise = ExerciseSchema.parse(
      clean({
        ...input,
        name: input.name.trim(),
        id: ctx.newId(),
        isCustom: true,
        archived: false,
      }),
    );
    await assertNameFree(ctx, exercise.name);
    await ctx.db.exercises.add(exercise);
    return exercise;
  });
}

export async function updateExercise(ctx: DataContext, exercise: Exercise): Promise<Exercise> {
  return ctx.db.transaction('rw', ctx.db.exercises, async () => {
    const parsed = ExerciseSchema.parse(clean({ ...exercise, name: exercise.name.trim() }));
    if (!(await ctx.db.exercises.get(parsed.id))) throw new Error(`No exercise ${parsed.id}`);
    await assertNameFree(ctx, parsed.name, parsed.id);
    await ctx.db.exercises.put(parsed);
    return parsed;
  });
}

/** Exercises are archived, never deleted, because past sets and plans point at them. */
export async function archiveExercise(ctx: DataContext, id: string): Promise<void> {
  const updated = await ctx.db.exercises.update(id, { archived: true });
  if (updated === 0) throw new Error(`No exercise ${id}`);
}
