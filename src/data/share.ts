import type { Result } from '../domain/errors';
import { planProgramImport, type ImportPlan } from '../domain/import';
import {
  BandSchema,
  DayTemplateSchema,
  ExerciseSchema,
  ProgramSchema,
  type Program,
} from '../domain/schemas';
import {
  buildProgramShare,
  encodeShareCode,
  parseShareInput,
  type ProgramShare,
} from '../domain/share';
import { loadBandMap } from './bands';
import { clean } from './clean';
import type { DataContext } from './context';
import { loadExerciseMap } from './exercises';
import { getProgram } from './programs';

export async function shareProgram(
  ctx: DataContext,
  programId: string,
): Promise<{ share: ProgramShare; code: string }> {
  const loaded = await getProgram(ctx, programId);
  if (!loaded) throw new Error(`No program ${programId}`);
  const share = buildProgramShare(
    loaded.program,
    loaded.dayTemplates,
    await loadExerciseMap(ctx),
    await loadBandMap(ctx),
  );
  return { share, code: encodeShareCode(share) };
}

export type ImportPreview =
  { ok: true; share: ProgramShare; plan: ImportPlan } | { ok: false; error: string };

/** Parses a pasted code or file text and works out what an import would add. Writes nothing. */
export async function previewImport(ctx: DataContext, text: string): Promise<ImportPreview> {
  const parsed = parseShareInput(text);
  if (!parsed.ok) return parsed;
  const [exercises, bands, programs] = await Promise.all([
    ctx.db.exercises.toArray(),
    ctx.db.bands.toArray(),
    ctx.db.programs.toArray(),
  ]);
  const planned = planProgramImport({
    share: parsed.share,
    existingExercises: exercises,
    existingBands: bands,
    existingProgramNames: programs.map((p) => p.name),
    newId: ctx.newId,
  });
  if (!planned.ok) return planned;
  return { ok: true, share: parsed.share, plan: planned.plan };
}

/** Adds a shared program as a new, inactive program, with any exercises and bands it needs. */
export async function importProgram(
  ctx: DataContext,
  text: string,
): Promise<Result<Program, 'program'>> {
  const { db } = ctx;
  const preview = await previewImport(ctx, text);
  if (!preview.ok) return preview;
  const { plan } = preview;
  await db.transaction('rw', [db.programs, db.dayTemplates, db.exercises, db.bands], async () => {
    await db.exercises.bulkAdd(plan.newExercises.map((e) => ExerciseSchema.parse(clean(e))));
    await db.bands.bulkAdd(plan.newBands.map((b) => BandSchema.parse(clean(b))));
    await db.dayTemplates.bulkAdd(plan.dayTemplates.map((d) => DayTemplateSchema.parse(clean(d))));
    await db.programs.add(ProgramSchema.parse(clean(plan.program)));
  });
  return { ok: true, program: plan.program };
}
