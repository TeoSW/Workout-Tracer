import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import { z } from 'zod';
import { fromBase64Url, toBase64Url } from './base64url';
import { APP_ID } from './config';
import { firstIssue, type Result } from './errors';
import {
  DayTemplateSchema,
  ExerciseSchema,
  ProgramSchema,
  type Block,
  type DayTemplate,
  type Exercise,
  type Program,
} from './schemas';

export const SHARE_SCHEMA_VERSION = 1;
export const SHARE_CODE_PREFIX = 'WT1.';

export const ProgramShareSchema = z.object({
  app: z.literal(APP_ID),
  kind: z.literal('program'),
  schemaVersion: z.literal(SHARE_SCHEMA_VERSION),
  program: ProgramSchema,
  dayTemplates: z.array(DayTemplateSchema),
  /** Only custom exercises. Built-in exercises are referenced by their stable ids. */
  exercises: z.array(ExerciseSchema),
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
): ProgramShare {
  const used = new Set(dayTemplates.flatMap((d) => d.blocks.flatMap(exerciseIdsOf)));
  const exercises = [...used]
    .map((id) => exercisesById.get(id))
    .filter((e): e is Exercise => e !== undefined && e.isCustom);
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
  let raw: unknown;
  try {
    raw = JSON.parse(strFromU8(inflateSync(fromBase64Url(code.slice(SHARE_CODE_PREFIX.length)))));
  } catch {
    return { ok: false, error: 'This share code is damaged.' };
  }
  return validate(raw);
}
