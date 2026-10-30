import { z } from 'zod';
import { APP_ID } from './config';
import type { DateStr } from './dates';
import { firstIssue, type Result } from './errors';
import {
  BandSchema,
  BodyweightEntrySchema,
  DayTemplateSchema,
  EpochMsSchema,
  ExerciseSchema,
  LoggedSetSchema,
  ProgramSchema,
  RestTimerSchema,
  SessionExerciseSchema,
  SessionSchema,
  SettingRowSchema,
  TestResultSchema,
} from './schemas';

/** Bump with every Dexie schema change, and add a migration from the previous version. */
export const BACKUP_SCHEMA_VERSION = 1;

export const BackupDataSchema = z.object({
  exercises: z.array(ExerciseSchema),
  bands: z.array(BandSchema),
  programs: z.array(ProgramSchema),
  dayTemplates: z.array(DayTemplateSchema),
  sessions: z.array(SessionSchema),
  sessionExercises: z.array(SessionExerciseSchema),
  sets: z.array(LoggedSetSchema),
  bodyweight: z.array(BodyweightEntrySchema),
  testResults: z.array(TestResultSchema),
  settings: z.array(SettingRowSchema),
  restTimer: z.array(RestTimerSchema),
});

export const BackupFileSchema = z.object({
  app: z.literal(APP_ID),
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
  exportedAt: EpochMsSchema,
  data: BackupDataSchema,
});

export type BackupData = z.infer<typeof BackupDataSchema>;
export type BackupFile = z.infer<typeof BackupFileSchema>;
export type BackupTable = keyof BackupData;

/** A migration turns a whole backup file of version N into version N + 1. */
export type BackupMigration = (file: Record<string, unknown>) => Record<string, unknown>;

/** Keyed by the version a migration upgrades from. Empty while there is only version 1. */
export const BACKUP_MIGRATIONS: Readonly<Record<number, BackupMigration>> = {};

export function emptyBackupData(): BackupData {
  return {
    exercises: [],
    bands: [],
    programs: [],
    dayTemplates: [],
    sessions: [],
    sessionExercises: [],
    sets: [],
    bodyweight: [],
    testResults: [],
    settings: [],
    restTimer: [],
  };
}

export function createBackup(data: BackupData, exportedAt: number): BackupFile {
  return { app: APP_ID, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt, data };
}

const EnvelopeSchema = z.looseObject({ app: z.literal(APP_ID), schemaVersion: z.number().int() });

/** Validates a parsed backup file and migrates it to the current schema version. */
export function parseBackup(
  raw: unknown,
  migrations: Readonly<Record<number, BackupMigration>> = BACKUP_MIGRATIONS,
): Result<BackupFile, 'backup'> {
  const envelope = EnvelopeSchema.safeParse(raw);
  if (!envelope.success) return { ok: false, error: 'This is not a Workout Tracker backup.' };
  if (envelope.data.schemaVersion > BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      error: 'This backup comes from a newer version of the app. Update the app, then try again.',
    };
  }

  let file: Record<string, unknown> = envelope.data;
  for (let v = envelope.data.schemaVersion; v < BACKUP_SCHEMA_VERSION; v++) {
    const migrate = migrations[v];
    if (!migrate)
      return { ok: false, error: 'This backup uses an old format the app cannot read.' };
    file = migrate(file);
  }

  const parsed = BackupFileSchema.safeParse(file);
  if (!parsed.success) {
    return { ok: false, error: `The backup file is damaged: ${firstIssue(parsed.error)}` };
  }
  return { ok: true, backup: parsed.data };
}

export function backupFileName(date: DateStr): string {
  return `${APP_ID}-backup-${date}.json`;
}

export function recordCounts(backup: BackupFile): Record<BackupTable, number> {
  return Object.fromEntries(
    Object.entries(backup.data).map(([table, rows]) => [table, rows.length]),
  ) as Record<BackupTable, number>;
}
