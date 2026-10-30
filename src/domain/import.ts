import type { Result } from './errors';
import type { Band, DayTemplate, Exercise, Program } from './schemas';
import type { ProgramShare } from './share';
import { copyProgramStructure, type NewId } from './templates';

export type ImportPlan = {
  program: Program;
  dayTemplates: DayTemplate[];
  /** Custom exercises from the share that matched nothing on this phone. */
  newExercises: Exercise[];
  /** Bands from the share whose rated kg matched no band on this phone. */
  newBands: Band[];
};

const nameKey = (name: string) => name.trim().toLowerCase();

/** "Name", or "Name (2)", "Name (3)" when the name is taken. Case is ignored. */
export function uniqueProgramName(name: string, existing: readonly string[]): string {
  const taken = new Set(existing.map(nameKey));
  if (!taken.has(nameKey(name))) return name;
  for (let n = 2; ; n++) {
    const candidate = `${name} (${n})`;
    if (!taken.has(nameKey(candidate))) return candidate;
  }
}

/**
 * Works out the records an import adds, without writing anything. Custom exercises are matched
 * to existing ones by name, ignoring case; built-in exercises by their stable id. Bands are
 * matched by rated kg. Everything new gets a fresh id.
 */
export function planProgramImport(input: {
  share: ProgramShare;
  existingExercises: readonly Exercise[];
  existingBands: readonly Band[];
  existingProgramNames: readonly string[];
  newId: NewId;
}): Result<ImportPlan, 'plan'> {
  const { share, newId } = input;
  const existingById = new Map(input.existingExercises.map((e) => [e.id, e]));
  const existingByName = new Map<string, Exercise>();
  for (const e of input.existingExercises) {
    const key = nameKey(e.name);
    const current = existingByName.get(key);
    if (!current || (current.archived && !e.archived)) existingByName.set(key, e);
  }

  const exerciseIds = new Map<string, string>();
  const newExercises: Exercise[] = [];
  for (const e of share.exercises) {
    const match = existingByName.get(nameKey(e.name));
    if (match) {
      exerciseIds.set(e.id, match.id);
    } else {
      const copy: Exercise = {
        ...structuredClone(e),
        id: newId(),
        isCustom: true,
        archived: false,
      };
      exerciseIds.set(e.id, copy.id);
      newExercises.push(copy);
    }
  }
  for (const copy of newExercises) {
    copy.alternativeIds = copy.alternativeIds.flatMap((id) => {
      const mapped = exerciseIds.get(id) ?? (existingById.has(id) ? id : undefined);
      return mapped === undefined ? [] : [mapped];
    });
  }

  const referenced = share.dayTemplates.flatMap((d) =>
    d.blocks.flatMap((b) =>
      b.kind === 'exercise' ? [b.exerciseId] : b.choiceSlot.options.map((o) => o.exerciseId),
    ),
  );
  if (referenced.some((id) => !exerciseIds.has(id) && !existingById.has(id))) {
    return {
      ok: false,
      error:
        'This program uses exercises this app does not have yet. Update the app, then try again.',
    };
  }

  const usableBands = input.existingBands.filter((b) => !b.archived);
  const bandIds = new Map<string, string>();
  const newBands: Band[] = [];
  for (const band of share.bands ?? []) {
    const match =
      usableBands.find((b) => b.id === band.id && b.ratedKg === band.ratedKg) ??
      usableBands.find((b) => b.ratedKg === band.ratedKg) ??
      newBands.find((b) => b.ratedKg === band.ratedKg);
    if (match) {
      bandIds.set(band.id, match.id);
    } else {
      const copy: Band = { ...structuredClone(band), id: newId() };
      delete copy.archived;
      bandIds.set(band.id, copy.id);
      newBands.push(copy);
    }
  }
  const knownBandIds = new Set(input.existingBands.map((b) => b.id));
  const mapBandIds = (ids: readonly string[]) =>
    ids.flatMap((id) => {
      const mapped = bandIds.get(id) ?? (knownBandIds.has(id) ? id : undefined);
      return mapped === undefined ? [] : [mapped];
    });

  const { program, dayTemplates } = copyProgramStructure(
    { ...share.program, dayTemplates: share.dayTemplates },
    {
      newId,
      name: uniqueProgramName(share.program.name, input.existingProgramNames),
      mapExerciseId: (id) => exerciseIds.get(id) ?? id,
      mapBandIds,
    },
  );
  return { ok: true, plan: { program, dayTemplates, newExercises, newBands } };
}
