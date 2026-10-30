import { Dexie, type EntityTable } from 'dexie';
import { APP_ID } from '../domain/config';
import type { BackupFile, BackupTable } from '../domain/backup';
import type {
  Band,
  BodyweightEntry,
  DayTemplate,
  Exercise,
  LoggedSet,
  Program,
  RestTimer,
  Session,
  SessionExercise,
  SettingRow,
  TestResult,
} from '../domain/schemas';

/**
 * Bump together with BACKUP_SCHEMA_VERSION. Each bump adds a `version(n)` with its upgrader here
 * and a backup migration in src/domain/backup.ts.
 */
export const DB_SCHEMA_VERSION = 1;

/** The copy of all data kept before a restore, for "Undo last restore". Never backed up. */
export type Snapshot = { id: 'pre-restore'; createdAt: number; backup: BackupFile };

export type WorkoutDb = Dexie & {
  exercises: EntityTable<Exercise, 'id'>;
  bands: EntityTable<Band, 'id'>;
  programs: EntityTable<Program, 'id'>;
  dayTemplates: EntityTable<DayTemplate, 'id'>;
  sessions: EntityTable<Session, 'id'>;
  sessionExercises: EntityTable<SessionExercise, 'id'>;
  sets: EntityTable<LoggedSet, 'id'>;
  bodyweight: EntityTable<BodyweightEntry, 'date'>;
  testResults: EntityTable<TestResult, 'id'>;
  settings: EntityTable<SettingRow, 'key'>;
  restTimer: EntityTable<RestTimer, 'id'>;
  snapshots: EntityTable<Snapshot, 'id'>;
};

// Booleans, null and undefined are not indexable in IndexedDB, so flags like `active` are
// filtered in memory. Tables are small.
const SCHEMA_V1 = {
  exercises: 'id, name',
  bands: 'id',
  programs: 'id',
  dayTemplates: 'id, programId',
  sessions: 'id, programId, date, status',
  sessionExercises: 'id, sessionId',
  sets: 'id, sessionId, sessionExerciseId, exerciseId',
  bodyweight: 'date',
  testResults: 'id, sessionId, exerciseId',
  settings: 'key',
  restTimer: 'id',
  snapshots: 'id',
} satisfies Record<BackupTable | 'snapshots', string>;

export const BACKUP_TABLES: readonly BackupTable[] = [
  'exercises',
  'bands',
  'programs',
  'dayTemplates',
  'sessions',
  'sessionExercises',
  'sets',
  'bodyweight',
  'testResults',
  'settings',
  'restTimer',
];

export type DbOptions = NonNullable<ConstructorParameters<typeof Dexie>[1]> & { name?: string };

/** Opens the app database. Tests pass a fake-indexeddb factory through `options`. */
export function createDb(options: DbOptions = {}): WorkoutDb {
  const { name = APP_ID, ...dexieOptions } = options;
  const db = new Dexie(name, dexieOptions) as WorkoutDb;
  db.version(DB_SCHEMA_VERSION).stores(SCHEMA_V1);
  return db;
}
