# Milestone 2 plan: data layer and backup

Spec: `docs/superpowers/specs/2026-10-30-workout-tracker-design.md` (sections 4.8, 4.9, 8, 9, 10.3, 11, 13).
Builds on Milestone 1 (`src/domain`).

Goal: everything the app stores goes through `src/data`, on Dexie, with first-launch seeding, the active session and rest timer persisted, backup, restore with undo, CSV export, and program share and import.

Done when: `npm run check` is green and acceptance tests 11, 12 and 13 pass against fake-indexeddb.

Branch: `milestone-2-data`. One commit per task.

## What the docs and a quick spike confirmed

Checked against the current Dexie docs and a throwaway test with Dexie 4.4.7 and fake-indexeddb 6.2.7:

- Typed database: `new Dexie(name, { indexedDB, IDBKeyRange }) as Dexie & { table: EntityTable<T, 'id'> }`. Passing the factory explicitly lets each test use a fresh `new IDBFactory()` from fake-indexeddb, with no globals.
- Schema strings: first entry is the primary key (`id` for our string ids, no `++`), `[a+b]` compound, `*a` multi-entry. Booleans, null and undefined are not indexable, so no index on `active`, `archived` or `done`.
- Upgrades: `db.version(n).stores({...}).upgrade(tx => ...)`. Old `version()` declarations only need to stay when they carry an upgrader.
- Transactions: `db.transaction('rw', tables, async () => ...)`. Native `await` is fine; other async work inside a transaction needs `Dexie.waitFor`, so repositories never await anything but Dexie inside one.
- `db.tables`, clearing every table inside one transaction, and `delete()` then reopening all work.
- **IndexedDB keeps properties whose value is `undefined`; JSON drops them.** A record written as `{ a: undefined }` would not deep-equal its backup round trip. Every write goes through a `clean()` helper that removes `undefined` properties (deeply), so stored data always equals its JSON form.

## Decisions for this milestone

1. **Band list in shared programs** (approved by the user): the share file gets an optional `bands` field with every band the program's targets use, seeded ones included. On import each band is matched by `ratedKg` to the friend's bands and created if missing. Old codes without `bands` still import; unknown band ids are then dropped from targets. `schemaVersion` stays 1, since the field is optional and older parsers ignore it. The backup format does not change.
2. **Built-in templates stay in code**, read from `src/domain/fixtures`. They are read-only and copied into a program when used, so storing them would only add a copy that can drift. Seeding writes the bands and the exercise library. A `seedVersion` setting lets a later release add new built-in exercises without touching ones the user edited or archived.
3. **Injected clock and ids.** Repositories take a `DataContext = { db, clock: { now(): number; today(): DateStr }, newId(): string }`. The app builds it with `Date.now`, the local date and `crypto.randomUUID()`; tests use a fixed clock and counter ids.
4. **Repositories are plain async functions** grouped per table. Milestone 3 wraps reads in `useLiveQuery`; this milestone has no React.
5. **Set rows are created when a session starts**: `warmupSets` warm-up rows plus `setsMin` working rows per block, each with a snapshot of its target. Values stay empty until logged. The "last time" prefill is a Milestone 4 concern.
6. **CSV covers done sets of finished sessions**, one row per set, in the spec's column order, RFC 4180 quoting, CRLF line endings so Excel and Numbers open it cleanly.
7. **Pre-restore snapshot** lives in its own `snapshots` table, which is never part of a backup. One snapshot is kept: a new restore replaces it.

## Schema v1

```
exercises        'id, name'
bands            'id'
programs         'id'
dayTemplates     'id, programId'
sessions         'id, programId, date, status'
sessionExercises 'id, sessionId'
sets             'id, sessionId, exerciseId, [sessionId+order]'
bodyweight       'date'
testResults      'id, sessionId, exerciseId'
settings         'key'
restTimer        'id'
snapshots        'id'
```

`DB_SCHEMA_VERSION` equals `BACKUP_SCHEMA_VERSION` and a test keeps them in sync, so a Dexie upgrade cannot ship without a backup migration.

## File layout

```
src/domain/
  share.ts          + bands field, buildProgramShare takes bands
  import.ts         planProgramImport: pure id remapping, name matching, band matching, rename on clash
  csv.ts            setRowsToCsv
  session-rows.ts   buildSessionRows: session exercises and set rows from a plan snapshot
src/data/
  db.ts             WorkoutDb type, createDb(options), schema v1
  context.ts        DataContext, createDefaultContext()
  clean.ts          strip undefined before writes
  seed.ts           seedIfNeeded
  settings.ts  bands.ts  exercises.ts  bodyweight.ts
  programs.ts       create from template, activate, update, set current week, deload this week, archive, delete
  sessions.ts       start, active session, log and edit sets, add, remove, move, swap, pick choice, finish, delete
  rest-timer.ts     start, extend, skip, current
  test-results.ts   save results and next cycle's pick
  backup.ts         export, restore with snapshot, undo last restore
  csv.ts            export rows
  share.ts          share a program, import a program
tests/unit/data/    one file per repository, plus helpers.ts (fresh fake-indexeddb, fixed clock)
```

ESLint: `src/data` must not import React or Ionic, same rule as the domain. It may use Dexie.

## Tasks

### Task 0: test harness

- `tests/unit/data/helpers.ts`: `testContext()` returns a `DataContext` on a fresh `IDBFactory` with a fixed clock (`2026-11-02 10:00` local) that tests can advance, and counter ids.
- ESLint override for `src/data/**`.
- Test: the context opens, writes and reads a row; a second context does not see it.
- Commit: `chore: add data layer test harness`.

### Task 1: domain additions

- `share.ts`: optional `bands`, `buildProgramShare(program, dayTemplates, exercisesById, bandsById)`.
- `import.ts`: `planProgramImport({ share, existingExercises, existingBands, existingProgramNames, newId })` returns `{ program, dayTemplates, newExercises, newBands }`. Fresh ids for program, days, blocks and choice slots (shared slots stay shared). Custom exercises matched by case-insensitive name, otherwise created as custom with fresh ids; built-in ids kept when they exist locally. Alternative ids remapped. Bands matched by `ratedKg`, otherwise created. Name clash gives "Name (2)", then "(3)".
- `session-rows.ts`: `buildSessionRows({ sessionId, snapshot, newId })` for exercise blocks; choice blocks with no pick get no rows until picked. Superset groups keep block order.
- `csv.ts`: `setRowsToCsv(rows)` with the section 8 columns and quoting.
- Tests: old share codes without `bands` still parse; import keeps schedule references and slot sharing; name matching ignores case; a band missing on the friend's phone is created once even if several targets use it; CSV quoting of commas, quotes and line breaks in notes; row counts for Program C Heavy (warm-up 1, complexes 3 and 3, choice none until picked).
- Commit: `feat(domain): add program import planning, session rows and CSV`.

### Task 2: database, context and clean writes

- `db.ts`, `context.ts`, `clean.ts` as above.
- Tests: `clean` removes nested `undefined` and keeps `null`, `0`, `false` and empty arrays; schema version matches the backup version; data survives closing and reopening the database.
- Commit: `feat(data): add Dexie schema v1`.

### Task 3: seeding

- `seedIfNeeded(ctx)`: on first run, writes the seed bands and exercises and `seedVersion = 1`. On later runs adds only missing built-in ids.
- Tests: first run counts (3 bands, 54 exercises); a second run changes nothing; an archived or edited built-in exercise is not overwritten; a deleted built-in exercise is not re-added after the version is recorded.
- Commit: `feat(data): seed bands and exercises on first launch`.

### Task 4: settings, bands, exercises, bodyweight

- `getSettings` merges stored rows over `DEFAULT_SETTINGS`; `setSetting(key, value)` validates against `AppSettingsSchema`.
- Bands: list, add, rename, archive (never hard delete, since past sets and targets reference them).
- Exercises: list (search, muscle and tracking filters are UI work in Milestone 3, but `listExercises` returns active ones sorted by name), add custom, update, archive.
- Bodyweight: one entry per date, last write wins; list sorted.
- Commit: `feat(data): add settings, bands, exercises and bodyweight repositories`.

### Task 5: programs

- `createProgramFromTemplate(ctx, template, name?)`, `activateProgram(ctx, id, start: 'this_week' | 'next_week')` (sets `anchorDate`, deactivates the others in one transaction), `getActiveProgram`, `updateProgram`, `saveDayTemplate`, `deleteDayTemplate`, `setCurrentWeek`, `deloadThisWeek`, `archiveProgram`, `deleteProgram` (deletes its day templates, keeps sessions).
- Tests: only one active program; anchor is this or next Monday; validation rejects a grid that no longer matches `cycleWeeks`.
- Commit: `feat(data): add program repository`.

### Task 6: sessions and rest timer (acceptance 13)

- `startPlannedSession(ctx, { programId, dayTemplateId, rotationIndex? })` resolves the plan with `resolvePlan`, stores the snapshot, session exercises and set rows. Rotation index comes from `todayPlan` or `rotationIndexForPick` for another day.
- `startEmptySession`, `getActiveSession` (with exercises and sets), `updateSet`, `addSet`, `removeSet`, `toggleWarmup`, `addExercise`, `removeExercise`, `moveExercise`, `swapExercise` (this session only, records `swappedFromExerciseId`), `pickChoice` (updates the snapshot, saves the pick for the session's cycle on the program, creates rows), `finishSession` (status, `finishedAt`, notes, returns PR flags from `detectPrs`), `deleteSession`, `updateFinishedSession`.
- Rest timer: `startRestTimer(ctx, sessionId, durationSec)`, `extendRestTimer`, `skipRestTimer`, `getRestTimer`. Cleared on finish.
- Tests: acceptance 13 (start a session, edit and delete blocks of the program, the stored snapshot is unchanged); starting a second session while one is active is refused; the active session and timer survive closing and reopening the database; finishing returns an e1RM PR when one is beaten.
- Commit: `feat(data): add session and rest timer repositories`.

### Task 7: test results

- `saveTestResults(ctx, { sessionId, results, choice })`: stores one result per hold exercise and, when a choice is given, saves it for `testFlowTargetCycle(session.cycleNumber)`.
- Tests: a test in cycle 1 saves the pick for cycle 2; a test before week 1 saves for cycle 1.
- Commit: `feat(data): save test results and next cycle's pick`.

### Task 8: backup, restore, undo (acceptance 11)

- `exportBackup(ctx)` returns a `BackupFile` of every table except `snapshots` and sets `lastBackupAt`. `backupToJson`.
- `restoreBackup(ctx, backup)` in one transaction: snapshot current data, clear, write. `undoLastRestore(ctx)`, `hasUndoSnapshot(ctx)`.
- Tests: acceptance 11 with a realistic data set (Program C active, two finished sessions, an active session with a rest timer, bodyweight, test results, settings); restore of a parsed JSON string; undo brings back the pre-restore data deep-equal; a failed write leaves the old data in place.
- Commit: `feat(data): add backup, restore and undo`.

### Task 9: CSV export

- `exportCsv(ctx)` joins sessions, programs, exercises and bands into `setRowsToCsv`.
- Test: one finished session gives the expected header and rows; active sessions and not-done sets are left out.
- Commit: `feat(data): add CSV export`.

### Task 10: share and import (acceptance 12)

- `shareProgram(ctx, programId)` returns the `ProgramShare` and its code. `previewImport(ctx, text)` parses and plans without writing. `importProgram(ctx, text)` writes the planned records in one transaction.
- Tests: acceptance 12 (every built-in template survives a code round trip through a second, fresh database; import creates fresh ids; a custom exercise is reused by name in any case; Program A imported twice is named "ULU/LUL (2)"); a custom band on the sender's phone is created on the receiver's.
- Commit: `feat(data): add program share and import`.

### Task 11: verification and review

- `npm run check` green, read the output. Grep for dashes in new text.
- Code review of the branch, fix findings, report to the user. Merge waits for the user.
