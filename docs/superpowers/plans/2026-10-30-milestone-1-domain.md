# Milestone 1 plan: domain model and fixtures

Spec: `docs/superpowers/specs/2026-10-30-workout-tracker-design.md` (sections 4, 5, 7, 8, 9, 11, 13).

Goal: every rule in the spec that can be a pure function lives in `src/domain`, is typed, and is covered by tests. No UI, no Dexie, no browser APIs.

Done when: `npm run check` (typecheck, lint, format check, tests) is green and acceptance tests 1-10, 14 and the codec part of 12 pass.

Branch: `milestone-1-domain`. One commit per task, Conventional Commits style, message ends with the co-author line.

## Ground rules for every task

- Test first. Write the failing test, run it, see it fail for the right reason, write the smallest code that passes, run the full suite, commit.
- `src/domain` imports only `zod`, `date-fns` and `fflate`. No `Date.now()`, no `new Date()` without an argument, no `window`, `document`, `navigator`, `crypto`, `btoa`, `atob`. ESLint enforces this (task 0).
- Ids are passed in. Functions that create records take a `newId: () => string` argument. The app will pass `() => crypto.randomUUID()`; tests pass a counter.
- Calendar dates are `yyyy-mm-dd` strings (`DateStr`). Week math uses date-fns with `weekStartsOn: 1`.
- Writing rules from spec section 12 apply to code comments, test names and commit messages too.

## Refinements to the spec's field lists

Section 4 says the field lists are a guide. These are the refinements, with reasons. None of them changes a concept or a rule.

1. **Choice selections are keyed by `slotId`, not `blockId`.** Program C has two Heavy templates (planche first, front lever first), each with its own accessory block. One pick has to apply to both, so the choice slot gets a stable `id` shared by both blocks, and `choiceSelections[]` is `{ cycleNumber, slotId, optionIndex }`.
2. **Sessions store `date`** (local `yyyy-mm-dd` of the start). Stats, the calendar and "is today done" all group by local day, and storing it avoids timezone math in every caller.
3. **Logged sets store `sessionExerciseId`** next to `sessionId` and `exerciseId`, so sets stay attached to the right card after a swap or when one exercise appears twice in a session.
4. **Built-in exercises, bands and template parts have stable slug ids** (`pull-ups`, `band-35`, `tpl-c-heavy-pl`). User-created records use UUIDs. Stable ids let fixtures reference each other, and they let a shared program point at built-in exercises on a friend's phone.
5. **Blocks carry a `kind`** (`exercise` or `choice`) so the union is a Zod discriminated union.
6. **Complex parts on a logged set** are `parts: { name, unit, value }[]`, mirroring `target.parts`.
7. **Lowest band level PR on complexes is tracked per progression level**, like the hold PR. Moving up a progression usually means a thicker band again, and a single all-time lowest band would block PRs after every progression change.
8. **No PR on the first log of an exercise.** A PR needs a previous value to beat, otherwise every first session flags everything.
9. **Deload note is skipped on `checklist` blocks.** The note is about stopping before your limit, which does not apply to a warm-up. Their set count is unchanged anyway (1 stays 1).

Open question for Milestone 2 (not blocking): program targets reference band ids. A friend's band list may differ, so share import needs a way to map them. Proposal: include the referenced bands in the share payload as an optional `bands` field and match them by `ratedKg` on import. I will ask before changing the share format.

## File layout

```
src/domain/
  config.ts            APP_NAME, APP_ID
  dates.ts             DateStr helpers on top of date-fns
  schemas.ts           Zod schemas for every record, types via z.infer
  schedule.ts          cycle position, planned day, rotation pointer, set current week, today
  deload.ts            deload week check, set halving, manual deload
  choice.ts            choice resolution, saving picks, test-flow cycle
  plan.ts              resolve a day template into a session plan snapshot
  effort.ts            RIR/RPE conversion, validation, display
  load.ts              band level, bodyweight lookup, effective load
  e1rm.ts              Epley with RIR, per-set and per-session best
  volume.ts            weekly sets per muscle, 4-week average
  prs.ts               PR detection
  consistency.ts       planned vs done per week, week streak, duration
  bodyweight.ts        7-day moving average
  skills.ts            hold and complex series, test result prefill
  rest.ts              rest timer remaining time
  backup.ts            backup file schema, migrations, file name
  base64url.ts         pure base64url encode and decode
  share.ts             program share schema, WT1 share codec
  fixtures/
    bands.ts
    exercises.ts
    templates/         program-a.ts program-b.ts program-c.ts full-body.ts upper-lower.ts ppl.ts blank.ts index.ts
    builders.ts        small helpers to write templates compactly
  index.ts             public exports
tests/unit/domain/     one test file per module, plus acceptance.test.ts
```

## Tasks

### Task 0: tooling

Files: `package.json`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.editorconfig`.

- Dev dependencies (all from spec section 10): `typescript`, `vitest`, `eslint`, `@eslint/js`, `typescript-eslint`, `prettier`. Runtime: `zod`, `date-fns`, `fflate`.
- Scripts, all cross-platform (only `&&`, no shell globs, no `rm`): `typecheck` (`tsc --noEmit`), `lint` (`eslint .`), `format` (`prettier --write .`), `format:check`, `test` (`vitest run`), `test:watch`, `check` (all four in a row).
- `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `moduleResolution: bundler`, `target: ES2022`, `verbatimModuleSyntax`.
- ESLint override for `src/domain/**`: `no-restricted-imports` for `react`, `react-dom`, `@ionic/*`, `dexie`, `dexie-react-hooks`; `no-restricted-globals` for `window`, `document`, `navigator`, `localStorage`, `indexedDB`, `crypto`, `btoa`, `atob`, `fetch`; `no-restricted-syntax` for `Date.now()` and `new Date()` with no arguments.
- Test: a throwaway `tests/unit/smoke.test.ts` that passes, then `npm run check` passes. Check the lint rule by temporarily adding `Date.now()` to a domain file and seeing lint fail.
- Commit: `chore: set up TypeScript, Vitest, ESLint and Prettier`.

### Task 1: config, dates, schemas

- `config.ts`: `APP_NAME = 'Workout Tracker'`, `APP_ID = 'workout-tracker'`.
- `dates.ts`: `DateStr` type, `isDateStr`, `toDateStr(date: Date)`, `parseDateStr`, `addDays`, `daysBetween(a, b)` (calendar days, DST safe), `mondayOf(date)`, `weekdayOf(date)` returning `mon`..`sun`, `dateOfEpochMs(ms)` (local day).
- `schemas.ts`: Zod schemas and inferred types for `Muscle`, `TrackingType`, `LoadUnit`, `EffortMode`, `DayType`, `SplitType`, `Weekday`, `Exercise`, `Band`, `ComplexPartTarget`, `SetTarget`, `ChoiceOption`, `ChoiceSlot`, `Block` (discriminated on `kind`), `DayTemplate`, `WeekdaySchedule`, `RotationSchedule`, `Schedule`, `ChoiceSelection`, `Program`, `PlanSnapshot`, `Session`, `SessionExercise`, `LoggedSet`, `BodyweightEntry`, `TestResult`, `RestTimer`, `AppSettings` with `DEFAULT_SETTINGS`, `SettingRow` (`{ key, value }`). Rules encoded in schemas: RIR is 0 to 5 in 0.5 steps or null; `setsMax >= setsMin` when present; `bodyweight_reps` sets never have both `addedKg > 0` and bands (refine on `LoggedSet` is not possible without the exercise, so this lives in a `validateSetForExercise` helper).
- Tests: schema accepts valid samples, rejects bad RIR (5.5, 1.25, -1), rejects `setsMax < setsMin`, date helpers around a DST change (2026-03-29 and 2026-10-25 in Europe/Bucharest are both 1 calendar day apart from the day before; run with `TZ=Europe/Bucharest` set in `vitest.config.ts` through `process.env.TZ` so results are the same on Windows and Linux).
- Commit: `feat(domain): add core schemas and date helpers`.

### Task 2: fixtures

- `fixtures/bands.ts`: `band-15`, `band-25`, `band-35` with `ratedKg` 15, 25, 35.
- `fixtures/exercises.ts`: all 54 exercises from section 9.2, exact names, tracking types, muscles, flags, rest. Ladder: `PROGRESSION_LADDER = ['Tuck', 'Advanced tuck', 'Straddle', 'Full']`. Alternatives on Lateral Raise and Tricep Above Head.
- `fixtures/builders.ts`: helpers such as `ex(dayId, n, exerciseId, sets, target, extras)` and `choice(...)` so templates read like the spec tables.
- `fixtures/templates/*`: a `BuiltInTemplate` type (`id`, `name`, `splitType`, `schedule`, `cycleWeeks`, `deloadWeeks`, `note`, `dayTemplates[]`) and the templates: Program A, B, C (section 9.3), Full Body, Upper/Lower, Push/Pull/Legs (9.4), plus `blankTemplate(splitType)` for every split type.
- `instantiateTemplate(template, { newId, name? })`: copies a template into a `Program` plus `DayTemplate[]` with fresh ids, remapping schedule references. `anchorDate` stays null until activation. Choice slot ids are remapped consistently so shared slots stay shared.
- Tests: every fixture parses with its schema; every referenced exercise and band id exists; exercise names are unique; Program C week 6 Saturday is Test; both Heavy templates share one slot id; Heavy (front lever first) is Heavy (planche first) with blocks 2 and 3 swapped; `instantiateTemplate` produces no ids that appear in the template and keeps the schedule pointing at its own day templates.
- Commit: `feat(domain): add seed bands, exercise library and built-in templates`.

### Task 3: schedule rules (acceptance 1, 2, 3)

- `cyclePosition(program, date)`: `{ weeksSinceAnchor, cycleNumber, cycleWeek }` using the section 5 formulas with a non-negative modulo. Returns null when there is no anchor or no cycle length.
- `plannedDayTemplateId(program, date)` for weekday grids (null for rest).
- `setCurrentWeek(program, today, n)`: returns a new `anchorDate` so that today is in week `n`.
- `nextRotationIndex(program, lastFinishedRotationIndex)` and `rotationIndexForPick(program, pointer, dayTemplateId)` (first position at or after the pointer, wrapping).
- `todayPlan({ program, finishedSessions, today })`: the planned day, cycle info, deload flag, and when today's planned workout is already finished, `done` plus the next planned day (next non-rest grid day, or the next rotation entry).
- Tests: the formulas with dates before the anchor (cycle 0 and negative), `setCurrentWeek` round trip, and acceptance tests 1, 2 and 3 exactly as written in section 11.
- Commit: `feat(domain): add schedule rules for weekday grids and rotations`.

### Task 4: deload (acceptance 4, 5)

- `DELOAD_NOTE = 'Stop 2-3 reps or a few seconds before your limit.'`
- `isDeloadWeek(program, date)`: `cycleWeek` in `deloadWeeks`, or `mondayOf(date)` in `manualDeloadWeeks`. Rotations count calendar weeks from `anchorDate`.
- `isDeloadDay(program, dayTemplate, date)`: the above unless `deloadExempt`.
- `applyDeload(dayTemplate, exercisesById)`: `setsMin` and `setsMax` become `ceil(n / 2)`, also inside choice options. Targets, loads and bands untouched. Note appended on a new line, except on checklist blocks.
- `addManualDeloadWeek(program, date)` and `removeManualDeloadWeek(program, date)`.
- Tests: halving table (1, 2, 3, 4), acceptance 4 (the week 6 list from section 9.3 checked block by block for both Heavy days, both Light days, Test and Legs), acceptance 5 (Program A with a manual deload on one week: that week halved, the week before and after not).
- Commit: `feat(domain): add deload rules`.

### Task 5: choice slots and plan snapshot (acceptance 6)

- `resolveChoice(program, slotId, cycleNumber)`: the selection for that cycle, else the latest earlier one, else `{ status: 'needs_pick' }`.
- `saveChoice(program, slotId, cycleNumber, optionIndex)`: returns a new program, replacing an existing pick for the same cycle and slot.
- `testFlowTargetCycle(cycleNumber) = max(cycleNumber, 0) + 1`.
- `resolvePlan({ program, dayTemplate, date, exercisesById })` in `plan.ts`: returns a `PlanSnapshot` (deep copy of the template with choices resolved where possible and the deload applied, plus `isDeload`, `cycleNumber`, `cycleWeek`). A resolved choice block becomes an exercise block that keeps the block id, note and rest, and records `fromSlotId` and `optionIndex`.
- Tests: acceptance 6, a pick in cycle 3 applies to cycle 5 when 4 and 5 have none, a later-cycle pick is ignored for an earlier cycle, the snapshot is a deep copy (mutating the template afterwards does not change it; this is the domain half of acceptance 13).
- Commit: `feat(domain): add choice slot resolution and plan snapshots`.

### Task 6: effort (acceptance 7)

- `rpeToRir`, `rirToRpe`, `isValidRir`, `isValidRpe`, `effortModeFor(settings, exercise)`, `formatEffort(rir, mode)` (`RIR 2`, `RPE 8`, `RIR 5+`, empty for null or `off`), `usesEffort(trackingType)`.
- Tests: acceptance 7, edge values (RPE 5 is RIR 5, RPE 10 is RIR 0), invalid steps rejected, per-exercise override wins over the global mode.
- Commit: `feat(domain): add RIR and RPE conversion`.

### Task 7: load, bands, e1RM (acceptance 8, 9)

- `bandLevel(bandIds, bandsById)`, `bodyweightOn(entries, date)`, `effectiveLoad(set, exercise, bodyweightEntries, date)` returning `{ kg, includesBodyweight }` or null.
- `epley(load, reps, rir)` rounded to 0.01, null when `reps + (rir ?? 0) > 15` or reps < 1. `setE1rm(...)`, `bestE1rmPerSession(...)`.
- Tests: acceptance 8 and 9, no bodyweight entry gives the added kg alone, bodyweight lookup picks the latest entry on or before the date, `hold` and banded sets get no e1RM.
- Commit: `feat(domain): add band level, effective load and e1RM`.

### Task 8: weekly volume (acceptance 10)

- `weeklySetsPerMuscle({ sessions, sets, exercisesById, weekStart })` and `averageWeeklySetsPerMuscle(..., weeks = 4)`. Only finished sessions, only done working sets, `attempts` and `checklist` count 0.
- Tests: acceptance 10, unfinished session ignored, not-done set ignored, Sunday belongs to the week that started on Monday, hold and complex count.
- Commit: `feat(domain): add weekly sets per muscle`.

### Task 9: PRs (acceptance 14)

- `detectPrs({ exercise, previous, current, bandsById, bodyweightEntries })` where `previous` and `current` are `{ session, sets }` lists. PR kinds: `heaviest_load`, `best_e1rm`, `most_reps` (keyed by load, added kg, band level or bodyweight), `longest_hold` (per level, clean only), `lowest_band` (complex, per level, clean and every part at target), `most_clean_attempts` (per session). One flag per kind and key, on the best set.
- Tests: acceptance 14, ties are not PRs, warm-ups and unfinished sessions never count, first log gives no PR, unclean holds never count.
- Commit: `feat(domain): add PR detection`.

### Task 10: consistency, bodyweight, skills, rest timer

- `consistency.ts`: `plannedSessionsInWeek(program, weekStart)`, `finishedSessionsInWeek`, `weekStreak(finishedDates, today)` (counts back from the current week, or from last week when the current week has none yet), `sessionDurationMs`.
- `bodyweight.ts`: `movingAverage7(entries)` over a calendar window of 7 days ending on each entry.
- `skills.ts`: `bestCleanHoldByLevel(...)` series, `complexBandSeries(...)` with share of clean sets, `bestCleanHoldInSession(sets)` for the test flow prefill.
- `rest.ts`: `restRemainingMs(timer, nowMs)`, `extendRest(timer, sec)`.
- Tests for each, including Program C planned count (6 in a normal week) and Program A (3).
- Commit: `feat(domain): add consistency, bodyweight and skill stats`.

### Task 11: backup schema

- `BACKUP_SCHEMA_VERSION = 1`, `BackupFileSchema` (`{ app: 'workout-tracker', schemaVersion, exportedAt, data }` with one array per table), `parseBackup(unknown)` returning `{ ok: true, backup } | { ok: false, error }`, a migration registry `migrations[fromVersion]` (empty for v1, but the loop runs), rejection of newer versions with a clear message, `backupFileName(date)`, `recordCounts(backup)`.
- Tests: valid file parses, wrong `app` rejected, newer version rejected, a fake v0 migration in the test proves the loop runs in order.
- Commit: `feat(domain): add backup file schema and migrations`.

### Task 12: share codec (codec part of acceptance 12)

- `base64url.ts`: pure encode and decode of `Uint8Array`, no padding.
- `ProgramShareSchema` exactly as section 8. `buildProgramShare(program, dayTemplates, exercisesById)` includes only custom exercises. `encodeShareCode(share)` gives `WT1.` + base64url(deflate(json)). `parseShareInput(text)` accepts a code (whitespace tolerated) or raw JSON and validates with Zod.
- Tests: base64url round trip on random bytes and known vectors, every built-in template survives encode then decode deep-equal, bad prefix, bad base64 and bad JSON give readable errors, a code with line breaks still decodes.
- Commit: `feat(domain): add program share codec`.

### Task 13: verification and review

- `npm run check` green, read the full output.
- Grep `src` for em and en dashes and `Date.now`.
- Code review of the branch diff, fix what it finds.
- Short report to the user. Merging into `main` waits for the user.
