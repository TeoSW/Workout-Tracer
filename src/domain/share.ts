import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import { z } from 'zod';
import { fromBase64Url, toBase64Url } from './base64url';
import { APP_ID } from './config';
import { firstIssue, type Result } from './errors';
import {
  BandSchema,
  DayTemplateSchema,
  ExerciseSchema,
  ProgramSchema,
  type Band,
  type Block,
  type DayTemplate,
  type Exercise,
  type Program,
} from './schemas';

export const SHARE_SCHEMA_VERSION = 1;
export const SHARE_CODE_PREFIX = 'WT1.';
/**
 * Deflate expands at most about 1000 times, so this caps an inflated code near 50 MB. Real codes
 * are under 5,000 characters.
 */
export const MAX_SHARE_CODE_LENGTH = 64_000;

export const ProgramShareSchema = z.object({
  app: z.literal(APP_ID),
  kind: z.literal('program'),
  schemaVersion: z.literal(SHARE_SCHEMA_VERSION),
  program: ProgramSchema,
  dayTemplates: z.array(DayTemplateSchema),
  /** Only custom exercises. Built-in exercises are referenced by their stable ids. */
  exercises: z.array(ExerciseSchema),
  /**
   * Every band the targets use, seeded ones included, so import can match them by rated kg.
   * Optional because codes made before this field existed have none.
   */
  bands: z.array(BandSchema).optional(),
});

export type ProgramShare = z.infer<typeof ProgramShareSchema>;

function exerciseIdsOf(block: Block): string[] {
  return block.kind === 'exercise'
    ? [block.exerciseId]
    : block.choiceSlot.options.map((o) => o.exerciseId);
}

/**
 * The share payload for a program. Per-user state (activation, anchor, manual deloads, picks)
 * is cleared, since it only means something on the sender's phone.
 */
export function buildProgramShare(
  program: Program,
  dayTemplates: readonly DayTemplate[],
  exercisesById: ReadonlyMap<string, Exercise>,
  bandsById: ReadonlyMap<string, Band>,
): ProgramShare {
  // Custom exercises used in blocks, plus custom alternatives they point at, so no
  // alternativeId dangles on the receiving phone.
  const pending = dayTemplates.flatMap((d) => d.blocks.flatMap(exerciseIdsOf));
  const seen = new Set<string>();
  const exercises: Exercise[] = [];
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    if (seen.has(id)) continue;
    seen.add(id);
    const exercise = exercisesById.get(id);
    if (!exercise?.isCustom) continue;
    exercises.push(exercise);
    pending.push(...exercise.alternativeIds);
  }
  exercises.sort((a, b) => a.name.localeCompare(b.name));
  const bandIds = new Set(
    dayTemplates.flatMap((d) =>
      d.blocks.flatMap((b) => [
        ...(b.target.bandIds ?? []),
        ...(b.kind === 'choice' ? b.choiceSlot.options.flatMap((o) => o.target.bandIds ?? []) : []),
      ]),
    ),
  );
  const bands = [...bandIds]
    .map((id) => bandsById.get(id))
    .filter((b): b is Band => b !== undefined)
    .sort((a, b) => a.ratedKg - b.ratedKg);
  return {
    app: APP_ID,
    kind: 'program',
    schemaVersion: SHARE_SCHEMA_VERSION,
    program: {
      ...structuredClone(program),
      active: false,
      archived: false,
      anchorDate: null,
      manualDeloadWeeks: [],
      choiceSelections: [],
    },
    dayTemplates: structuredClone([...dayTemplates]),
    exercises: structuredClone(exercises),
    bands: structuredClone(bands),
  };
}

/** WT1. followed by base64url of the deflated JSON. */
export function encodeShareCode(share: ProgramShare): string {
  return SHARE_CODE_PREFIX + toBase64Url(deflateSync(strToU8(JSON.stringify(share)), { level: 9 }));
}

function validate(raw: unknown): Result<ProgramShare, 'share'> {
  const looksRight = z
    .looseObject({ app: z.literal(APP_ID), kind: z.literal('program') })
    .safeParse(raw);
  if (!looksRight.success) return { ok: false, error: 'This is not a Workout Tracker program.' };
  const parsed = ProgramShareSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: `This program is damaged: ${firstIssue(parsed.error)}` };
  }
  return { ok: true, share: parsed.data };
}

/** Accepts a share code (spaces and line breaks are ignored) or the JSON of a program file. */
export function parseShareInput(text: string): Result<ProgramShare, 'share'> {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    let raw: unknown;
    try {
      raw = JSON.parse(trimmed);
    } catch {
      return { ok: false, error: 'This file is not valid JSON.' };
    }
    return validate(raw);
  }

  const code = trimmed.replace(/\s+/g, '');
  if (!code.startsWith(SHARE_CODE_PREFIX)) {
    return { ok: false, error: 'Paste a share code that starts with WT1. or a program file.' };
  }
  if (code.length > MAX_SHARE_CODE_LENGTH)
    return { ok: false, error: 'This share code is too long.' };
  let raw: unknown;
  try {
    raw = JSON.parse(strFromU8(inflateSync(fromBase64Url(code.slice(SHARE_CODE_PREFIX.length)))));
  } catch {
    return { ok: false, error: 'This share code is damaged.' };
  }
  return validate(raw);
}
