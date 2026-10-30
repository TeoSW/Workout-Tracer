# Workout Tracker: master prompt for Claude Code

## 0. Instructions for Claude Code

You are starting a new project in an empty folder: a free workout-tracking app for iPhone, built as a PWA that I and a few friends install from Safari. Everything after this section is an approved design spec. It was produced with the superpowers brainstorming skill (clarifying questions, stack options, a sectioned design, and my approval of every section). Do not run brainstorming again and do not reopen the decisions in section 14.

Do this, in order:

1. Initialize git if the folder isn't a repo yet. Save this whole file to `docs/superpowers/specs/2026-10-30-workout-tracker-design.md` and commit it as `docs: add approved design spec`.
2. The spec is too big for one plan. Use `superpowers:writing-plans` to write a plan for Milestone 1 only (section 13). When a milestone is done and verified, write the plan for the next one.
3. Execute each plan with `superpowers:subagent-driven-development` (or `superpowers:executing-plans` if subagents aren't available), using `superpowers:test-driven-development` for all domain and data code. Follow `superpowers:verification-before-completion` before calling anything done. At the end of each milestone, run `superpowers:requesting-code-review`, then `superpowers:finishing-a-development-branch`.
4. Libraries change. Before using an API from Ionic React 9 (released August 2026), Dexie, vite-plugin-pwa, Recharts or Playwright, check the current docs instead of relying on memory. If something in this spec is impossible or contradicted by the docs, stop and ask me before deviating.
5. Ask me before adding a dependency not named in section 10, before adding any runtime network call, and before any data model change that breaks the backup format.
6. I work on Windows 11 and Arch Linux. Every npm script must run on both: no bash-only syntax in package.json, Node-based tools for file operations.
7. After each milestone, tell me in a few lines what was built, the test results, and how to try it on my iPhone.
8. The writing rules in section 12 apply to everything you write: UI text, README, plans, commit messages, messages to me.

## 1. Product summary

A workout logger for iPhone. Each user logs workouts against a program (a split): sets, reps, load, bands, holds, skill attempts, RIR or RPE, deload weeks and test days. The app never prescribes progression. It shows the plan and what you did last time, then turns the logs into stats.

Users: me and a handful of friends, each on our own phone. No accounts, no server, no shared data. Working name "Workout Tracker", kept in one config constant so it can be renamed.

## 2. Constraints and platform facts

- Cost is zero: no Apple Developer Program, no paid hosting, no backend in v1.
- Distribution: a static site on GitHub Pages. Users open the URL in Safari and tap Share, then Add to Home Screen. Home screen web apps still work in the EU (Apple dropped its 2024 plan to remove them), which matters because we're in Romania.
- Target: iPhones on iOS 17 or later.
- iOS PWA facts the design depends on:
  - Storage in a Safari tab is separate from storage in the installed home screen app. Data created in a tab never appears in the installed app, so links can't move data into the app.
  - iOS can clear web app storage (low disk space, app removed). Backup is a core feature.
  - No background execution. JS timers stop when the app is backgrounded or the phone locks.
  - Audio plays only after a user tap has unlocked it.
  - No Vibration API, no HealthKit, no Live Activities, no widgets.
  - Web Push works only in home screen apps, needs a user tap to request permission, and needs a server to send pushes. That's phase 2 (section 15).
  - Feature-detect everything (Wake Lock, Web Share with files, `navigator.storage.persist()`) and degrade gracefully.
- English UI only. Units: kg only. Weeks start on Monday.

## 3. Scope

- v1 (milestones 1-6): everything in sections 4-11.
- Phase 2: lock screen "rest over" alert via Web Push from a free Cloudflare Worker (section 15).
- Possible later, not planned (needs the $99/year Apple account): a Capacitor wrapper with Apple Health and a Live Activity rest timer. Keep storage behind repository interfaces so this stays possible, and build nothing for it now.
- Out of scope: accounts, sync, social features, nutrition, body measurements other than bodyweight, progress photos, Apple Watch, Android-specific work (it will run on Android as a PWA, untested), lb units, progression suggestions, plate calculator, tempo.

## 4. Domain model

The field lists are a guide. Refine names during planning, but keep the concepts and rules.

### 4.1 Muscles

Fixed list used for volume stats: `chest, lats, upper_back, traps, front_delts, side_delts, rear_delts, biceps, triceps, forearms, abs, lower_back, glutes, quads, hamstrings, adductors, abductors, calves`.

### 4.2 Exercise

Fields: `id`, `name`, `trackingType`, `primaryMuscles[]`, `secondaryMuscles[]`, `unilateral` (sets are per leg or arm, shown as "/leg"), `loadUnit` (`total`, `per_hand` or `per_side`, display only: "4kg/hand", "12.5kg/side"), `defaultRestSec`, `cues`, `alternativeIds[]`, `progressionLadder` (optional ordered labels: tuck, advanced tuck, straddle, full), `effortInput` override (optional: `rir`, `rpe` or `off`), `isCustom`, `archived`.

| Tracking type | Logged per set | Example |
|---|---|---|
| `weight_reps` | kg, reps, effort | Mid Back Row 25kg x 10 |
| `bodyweight_reps` | reps, effort, plus either added kg or bands (never both) | Weighted Dips +25kg x 8; Pull-ups band 35+15 x 10 |
| `hold` | seconds, progression level, bands (optional), clean flag | Planche Hold, advanced tuck, 8s, clean |
| `complex` | per part: reps or seconds; per set: bands, progression level, clean flag | Planche Complex: hold 3s, press 3, push-up 3 |
| `attempts` | attempts, clean attempts | 540: 6 attempts, 4 clean |
| `checklist` | done | Warm-up |

### 4.3 Bands

User-defined list: `id`, `label` ("35kg"), `ratedKg`, optional `color`. A set can stack bands. Band level = sum of `ratedKg` of the bands used (35+15 gives 50). Lower is harder and 0 means no band. Band labels are resistance ratings, not real assistance, so band level is never subtracted from bodyweight.

### 4.4 Effort (RIR and RPE)

- Stored as `rir`: 0 to 5 in steps of 0.5, where 5 means "5 or more". Null when not logged.
- Effort input mode is `rir`, `rpe` or `off`, set globally with a per-exercise override.
- RPE input accepts 5 to 10 in steps of 0.5 and is saved as `rir = 10 - rpe`. Display converts back to the active mode.
- `hold` and `complex` sets use a `clean` flag instead of effort. `attempts` sets count clean attempts. `checklist` has no effort.

### 4.5 Set target and logged set

- Target (plan) fields, all optional: `repsMin`/`repsMax`, `secondsMin`/`secondsMax`, `attemptsMin`/`attemptsMax`, `loadMinKg`/`loadMaxKg`, `addedKg`, `bandIds[]`, `progressionLevel` (a ladder label or "current"), `parts[]` for complexes (`name`, `unit: reps | seconds`, `target`), `isMax` (test attempts), `note`.
- Logged set: `id`, `sessionId`, `exerciseId`, `order`, `kind` (`warmup` or `working`), `target` (snapshot), actual values for the tracking type, `rir`, `clean`, `done`, `completedAt`, `note`.

### 4.6 Day template

- Fields: `id`, `programId`, `name`, `dayType`, `deloadExempt`, `note`, `blocks[]`.
- Day types, each with a default color used in History: `hypertrophy, strength, skill_heavy, skill_light, dynamics, test, conditioning, custom`. Finishing a `test` day opens the test flow (section 6.4).
- Block: `id`, `order`, either `exerciseId` or `choiceSlot`, `setsMin`, optional `setsMax` (for "3-4 sets"), `target`, optional `restSec` (falls back to the exercise default), optional `supersetGroup`, `warmupSets` (default 0), `note`. Blocks sharing a `supersetGroup` are done back to back, and rest starts after the last one in the round.
- Choice slot: a `label` plus `options[]`, each with `exerciseId`, `setsMin`/`setsMax`, `target` and `pickWhen` (text explaining when to choose it). The picked option is stored on the program per cycle (section 5), so choice slots only exist in programs with a cycle length.

### 4.7 Program

- Fields: `id`, `name`, `splitType`, `schedule`, `cycleWeeks`, `deloadWeeks[]` (cycle week numbers), `anchorDate` (Monday of week 1 of cycle 1), `choiceSelections[]` (`{ cycleNumber, blockId, optionIndex }`), `manualDeloadWeeks[]` (ISO date of each week's Monday), `note`, `active` (one active program at a time), `archived`.
- Split types: `full_body, upper_lower, ppl, ppll, ulu_lul_rotation, calisthenics_cycle, custom`.
- Schedules:
  - Weekday grid: `weeks[]` with `cycleWeeks` entries, each mapping `mon` to `sun` to a day template id or rest.
  - Rotation: `sequence[]` of day template ids (a template may appear more than once), `sessionsPerWeek`, optional `preferredWeekdays[]` (only used for planned-vs-done stats). `cycleWeeks` is optional for rotations and only matters for deloads.
- Deload rule: `setsMin` and `setsMax` become `ceil(sets / 2)` (3 becomes 2, 2 becomes 1, 1 stays 1). Targets, loads and bands stay the same. Each block gets the note "Stop 2-3 reps or a few seconds before your limit."

### 4.8 Session (the log)

- Fields: `id`, optional `programId`, `dayTemplateId`, `cycleNumber`, `cycleWeek`, `rotationIndex`, plus `name`, `dayType`, `isDeload`, `startedAt`, `finishedAt`, `status` (`active` or `finished`), `notes`, and `planSnapshot`: the day template as resolved at start, with the deload applied and the choice slot resolved.
- Session exercises: `exerciseId`, `order`, optional `swappedFromExerciseId`, `note`, and their sets.
- At most one active session. Editing or deleting a program never changes past sessions.
- The rest timer state lives in the database (`endsAt` timestamp) so it survives reloads.

### 4.9 Other records

- Bodyweight entry: `date` (local `yyyy-mm-dd`, one per day, last write wins), `kg`.
- Test result: `sessionId`, `date`, `exerciseId`, `progressionLevel`, `bestHoldSec`, `note`, and the accessory picked for the next cycle.
- Settings (key-value): effort input mode, sound on/off, keep screen awake on/off, backup reminder days (default 14), muscle reference band (default 10-20 sets per week), last backup timestamp.

## 5. Schedule rules

All of these are pure functions in `src/domain`.

- Weekday programs: `weeksSinceAnchor = floor(daysBetween(anchorDate, date) / 7)`, `cycleNumber = floor(weeksSinceAnchor / cycleWeeks) + 1`, `cycleWeek = (weeksSinceAnchor mod cycleWeeks) + 1` (use a non-negative modulo). The planned day is `weeks[cycleWeek - 1][weekday(date)]`. Cycles repeat forever. A date before the anchor gives `cycleNumber` 0 or less.
- "Set current week to N" moves `anchorDate` so that today falls in week N.
- Rotation programs: next = `sequence[(lastRotationIndex + 1) mod sequence.length]`, where `lastRotationIndex` comes from the latest finished session of this program; with no sessions, index 0. Starting a different day from the sequence sets that session's `rotationIndex` to the day's first position after the current pointer, and the sequence continues from there. Always store `rotationIndex` on the session; looking it up by template id breaks when a template repeats in the sequence.
- A deload applies when `cycleWeek` is in `deloadWeeks` or the date's week is in `manualDeloadWeeks`, unless the day template is `deloadExempt`. For rotations, weeks are counted in calendar weeks from `anchorDate`.
- Choice slot resolution: the selection for the current `cycleNumber`, otherwise the latest earlier selection, otherwise "needs pick" (the logger asks). The test flow saves its pick for `cycleNumber + 1`, so a test done before the program's first week counts for cycle 1.
- Today: if today's planned workout is already finished, show it as done and show the next planned day. Missed weekday sessions are not shifted; they count as missed in the consistency stats.

## 6. Screens

Native iOS look: Ionic React in iOS mode, inset grouped lists, large titles, bottom sheets, action sheets, swipe actions, the system font, light and dark mode following the system. Tab bar: Today, History, Progress, Programs, Settings.

### 6.1 Today

The next workout from the active program, the cycle week ("Week 3 of 6", with a Deload badge when it applies) and a Start button. Rest days say so and still offer "Start another day" (any day of the program, Test included) and "Empty workout" (exercises added from the library). An unfinished session shows a Resume card instead. Quick bodyweight entry. With no active program, a button to pick one.

### 6.2 Workout logger

This is the layout I picked:

```
‹ Today          Upper A         Done
┌───────────────────────────────────┐
│ Pull-ups                        ⓘ │
│ 3 x 8-12 · band 35+15kg           │
├───────────────────────────────────┤
│ Set 1       10 reps   RIR 2    ✔  │
│ Set 2        9 reps   RIR 1    ✔  │
│ Set 3       tap to log            │
└───────────────────────────────────┘
┌───────────────────────────────────┐
│ Upper Chest                     ⓘ │
│ 3 x 8-12 · 4kg/hand               │
└───────────────────────────────────┘
```

- The header shows elapsed time. One inset card per exercise: name, plan line, and an info button for cues, block notes and alternatives.
- Done sets read like "Set 1 · 10 reps · RIR 2 ✓". Pending sets show last time's values in secondary text ("last: 35+15 x 9").
- Tapping a set opens a bottom sheet prefilled with last time's values. Lookup order: the same exercise and set number in the latest finished session of any program, then the last set of that exercise in that session, then the plan target (lower end of a range). Steppers for reps and kg, a stackable band picker, effort chips, and Done. A repeat set takes one tap.
- By tracking type: a hold gets a big start/stop stopwatch that fills in the seconds (still editable), a progression level picker and a clean toggle. A complex lists its parts with one stepper each, plus band, level and clean. Attempts get "+ clean" and "+ miss" counters with undo. A checklist item is one toggle.
- Swipe on a set: delete, or toggle warm-up. The exercise action sheet: add set, swap for an alternative (this session only), note, move up or down, remove.
- A block with `setsMax` starts with `setsMin` rows and shows "up to N" next to Add set.
- Supersets render as one joined card.
- A choice slot with no pick shows its options with their `pickWhen` text; the pick is saved for the current cycle.
- Every change is written to IndexedDB immediately, so closing or reloading the app loses nothing.
- Finish: confirm, then a summary with duration, working sets, new PRs and a session notes field. A test day continues to the test flow.

### 6.3 Rest timer and screen

- The timer starts when a set is marked done, with the block's rest (fallback: the exercise default). It's pinned above the tab bar with remaining time, +15s and Skip.
- Remaining time is computed from `endsAt`, so it's still right after the phone sleeps. At zero it plays a short sound (unlocked by the Start tap) and flashes. If the app was in the background, it shows "Rest over" when you come back.
- Request a Screen Wake Lock when a workout starts, request it again on `visibilitychange`, release it on finish. If unsupported, show a one-time tip.

### 6.4 Test flow

After finishing a `test` day: for each hold exercise in it, confirm the best clean hold (prefilled from the logged sets), the progression level and a note. Then, if the program has a choice slot, pick next cycle's option from a list that shows each option's `pickWhen` text. Save the test results and the choice selection.

### 6.5 Programs and library

- Program list with the active one on top. New program: pick a split type, then a template (built-in or blank), then a name. Activation sets `anchorDate` to the Monday of the current week or of next week (user's choice).
- Editor: schedule (weekday grid per cycle week, or rotation sequence plus sessions per week), cycle length, deload weeks, day templates (add, reorder and delete blocks; sets, targets, rest, supersets, choice slots), "Set current week", "Deload this week".
- Share program creates a JSON file and a share code (section 8). Import program takes a pasted code or a file, shows a preview, then adds it as a new program.
- The exercise library sits under this tab too: search, filters by muscle and tracking type, custom exercises, archive. Each exercise has a detail page with its history and charts.

### 6.6 History

A month calendar with days colored by day type, then a session list. Sessions open read-only with an Edit button. Editing can change any logged value. Deleting asks for confirmation.

### 6.7 Progress

Section 7.

### 6.8 Settings

Effort input (RIR, RPE or off), sound, keep screen awake, band list, backup and restore, CSV export, storage status (persistent or not, plus usage from `navigator.storage.estimate()`), backup reminder interval, app version.

### 6.9 Install and storage guidance

- Detect standalone mode (`display-mode: standalone` or `navigator.standalone`). In a Safari tab, show a banner with the Add to Home Screen steps and a warning that data saved in the tab won't appear in the installed app.
- On first launch in standalone mode, call `navigator.storage.persist()` and show the result in Settings.
- Show a backup reminder banner when the last backup is older than the reminder interval.

## 7. Progress and stats

Pure functions in `src/domain`. Only finished sessions count, and warm-up sets never do.

- Weekly sets per muscle (Monday to Sunday): each done working set adds 1 to each primary muscle and 0.5 to each secondary. `complex` and `hold` sets count as sets; `attempts` and `checklist` count 0. Bar chart for the selected week or a 4-week average, with the reference band drawn.
- e1RM, Epley with RIR: `load x (1 + (reps + (rir ?? 0)) / 30)`, only when `reps + (rir ?? 0) <= 15`. Load is the logged kg for `weight_reps` (per hand or per side stays as logged) and the effective load for weighted `bodyweight_reps`. Other sets get no e1RM. Keep the best set per session. Label it as a trend, not a max prediction.
- Effective load (`bodyweight_reps` with added weight): bodyweight on that date (latest entry on or before it) plus the added kg. Without any bodyweight entry, chart the added kg alone. Banded sets have no effective load; they chart band level instead.
- Skills: best clean hold per progression level over time, band level used on each complex over time with the share of clean sets, and the test results table.
- PRs per exercise, from working sets of finished sessions, flagged in the finish summary: heaviest load, best e1RM, most reps at a given load (or added kg, or band level), longest clean hold per progression level, lowest band level on a complex set where every part hit its target and the set was clean, most clean attempts in a session.
- Consistency: planned vs finished sessions per week (non-rest grid entries for weekday programs, `sessionsPerWeek` for rotations), week streak (consecutive Monday-to-Sunday weeks with at least one finished session), session duration.
- Bodyweight: chart with a 7-day moving average.
- Exercise detail page: the charts that fit its tracking type, plus its full set history.

## 8. Backup, export, import, sharing

- Full backup: JSON `{ app: "workout-tracker", schemaVersion, exportedAt, data }` with every table, saved as `workout-tracker-backup-YYYY-MM-DD.json`. Use the Web Share API with files when `navigator.canShare({ files })` allows it, otherwise a download link. Update the last backup timestamp after export.
- Restore: pick a file, validate it with Zod, migrate older `schemaVersion`s, show the record counts, then "Replace all data". Before replacing, keep the current data as a snapshot in IndexedDB and offer "Undo last restore" in Settings.
- CSV export: one row per logged set with date, program, day, exercise, set number, kind, kg, added kg, band level, reps, seconds, attempts, clean attempts, clean, RIR, RPE, note.
- Program share: JSON `{ app: "workout-tracker", kind: "program", schemaVersion, program, dayTemplates, exercises }` with the program, its day templates and any custom exercises they use. Share code: `WT1.` followed by base64url of the fflate-deflated JSON. Import accepts either form, creates fresh ids, matches exercises by name (case-insensitive) to existing ones, creates the missing ones as custom, and renames the program to "Name (2)" on a name clash.
- An error boundary around the whole app offers "Export my data", so a UI crash can't trap anyone's logs.

## 9. Seed data

Seeded on first launch: bands, the exercise library and the built-in templates. A template is copied into a user program when used, never edited in place. Rest is the exercise default unless a block says otherwise.

### 9.1 Bands

15kg, 25kg and 35kg (rated).

### 9.2 Exercise library

| Exercise | Tracking | Primary | Secondary | Flags | Rest (s) |
|---|---|---|---|---|---|
| Pull-ups | bodyweight_reps | lats | biceps, upper_back | | 120 |
| Upper Chest | weight_reps | chest | front_delts, triceps | per_hand | 120 |
| Kelso Shrug | weight_reps | upper_back | | per_hand | 75 |
| Lateral Raise | weight_reps | side_delts | | per_hand; alternatives: the 3 lateral raise variants below | 75 |
| Tricep Above Head | weight_reps | triceps | | alternatives: the 3 overhead triceps variants below | 75 |
| Mid Back Row | weight_reps | upper_back | lats, rear_delts, biceps | | 120 |
| Reverse Fly | weight_reps | rear_delts | upper_back | per_hand | 75 |
| Military Press | weight_reps | front_delts | triceps, side_delts | per_hand | 120 |
| Push-ups (incline) | bodyweight_reps | chest | triceps, front_delts | | 90 |
| Bicep Curl | weight_reps | biceps | forearms | per_hand | 75 |
| Tricep Below Head | weight_reps | triceps | | | 75 |
| Squat | weight_reps | quads | glutes, adductors | | 120 |
| Bulgarian Split Squat | weight_reps | quads | glutes, adductors | unilateral | 120 |
| Hip Thrust | weight_reps | glutes | hamstrings | | 120 |
| Lumbar Extension | weight_reps | lower_back | glutes, hamstrings | | 90 |
| Leg Extension | weight_reps | quads | | per_side | 75 |
| Hamstring Curl | weight_reps | hamstrings | | | 75 |
| Adductors | weight_reps | adductors | | | 75 |
| Abductors | weight_reps | abductors | glutes | | 75 |
| Calf Raise | weight_reps | calves | | | 75 |
| Ab Crunch | weight_reps | abs | | | 75 |
| Cable Lateral Raise (one arm) | weight_reps | side_delts | | unilateral | 75 |
| Machine Lateral Raise | weight_reps | side_delts | | | 75 |
| Lean-away Lateral Raise | weight_reps | side_delts | | unilateral | 75 |
| Cable Overhead Triceps Extension (rope) | weight_reps | triceps | | | 75 |
| Single-arm Dumbbell Overhead Extension | weight_reps | triceps | | unilateral | 75 |
| EZ-bar Skull Crusher | weight_reps | triceps | | | 75 |
| Planche Complex | complex | front_delts | chest, triceps, abs | ladder | 180 |
| Front Lever Complex | complex | lats | abs, upper_back, rear_delts | ladder | 180 |
| Planche Hold | hold | front_delts | chest, triceps, abs | ladder | 120 |
| Front Lever Hold | hold | lats | abs, upper_back, rear_delts | ladder | 120 |
| Weighted Dips | bodyweight_reps | chest | triceps, front_delts | | 150 |
| Weighted Pull-ups | bodyweight_reps | lats | biceps, upper_back | | 150 |
| Planche Lean | hold | front_delts | chest, abs | | 120 |
| Front Lever Raises | bodyweight_reps | lats | abs | ladder | 120 |
| Hollow Body Hold | hold | abs | | | 90 |
| 360 | attempts | | | | 150 |
| 540 | attempts | | | | 150 |
| Shrimp Flip | attempts | | | | 150 |
| Warm-up | checklist | | | | 0 |
| Barbell Back Squat | weight_reps | quads | glutes, adductors | | 150 |
| Bench Press | weight_reps | chest | triceps, front_delts | | 150 |
| Deadlift | weight_reps | glutes, hamstrings | lower_back, upper_back, traps, forearms | | 180 |
| Romanian Deadlift | weight_reps | hamstrings | glutes, lower_back | | 120 |
| Overhead Press | weight_reps | front_delts | triceps, side_delts | | 120 |
| Barbell Row | weight_reps | upper_back | lats, rear_delts, biceps | | 120 |
| Lat Pulldown | weight_reps | lats | biceps, upper_back | | 120 |
| Seated Cable Row | weight_reps | upper_back | lats, rear_delts, biceps | | 120 |
| Incline Dumbbell Press | weight_reps | chest | front_delts, triceps | per_hand | 120 |
| Leg Press | weight_reps | quads | glutes | | 120 |
| Triceps Pushdown | weight_reps | triceps | | | 75 |
| Hammer Curl | weight_reps | biceps | forearms | per_hand | 75 |
| Face Pull | weight_reps | rear_delts | upper_back | | 75 |
| Plank | hold | abs | | | 60 |

"ladder" means the progression ladder tuck, advanced tuck, straddle, full.

### 9.3 My programs (these are also the test fixtures)

Complex notation: "333" means one set of a 3-second hold, then 3 presses, then 3 push-ups. "555" means a 5-second hold, 5 touches, 5 pull-ups. Hold parts are counted in seconds, the other parts in reps.

**Program A: ULU/LUL.** Split `ulu_lul_rotation`. Rotation `[Upper A, Lower A, Upper B, Lower B]`, 3 sessions per week, preferred days Monday, Wednesday, Friday. No deload. Day type `hypertrophy` for all four days.

Upper A

| # | Exercise | Sets x target | Load | Note |
|---|---|---|---|---|
| 1 | Pull-ups | 3 x 8-12 | band 35+15 | Start each rep by pulling the shoulders down. |
| 2 | Upper Chest | 3 x 8-12 | 4kg/hand | Different day from Military Press on purpose. |
| 3 | Kelso Shrug | 3 x 8-12 | 7.5kg/hand | Squeeze the shoulder blades and hold 1s at the top. |
| 4 | Lateral Raise | 3 x 8-12 | 2kg/hand | |
| 5 | Tricep Above Head | 3 x 8-12 | 5kg | |

Upper B

| # | Exercise | Sets x target | Load | Note |
|---|---|---|---|---|
| 1 | Mid Back Row | 3 x 8-12 | 25kg | Squeeze the shoulder blades at the end of each rep. |
| 2 | Reverse Fly | 3 x 8-12 | 1-2kg/hand | Reverse pec deck or bent-over dumbbells. Superset with Push-ups if short on time. |
| 3 | Military Press | 3 x 8-12 | 2kg/hand | |
| 4 | Push-ups (incline) | 3 x 8-12 | bodyweight | Lower the surface to progress. |
| 5 | Bicep Curl | 3 x 8-12 | 3kg/hand | |
| 6 | Tricep Below Head | 3 x 8-12 | 10kg | |

Lower A

| # | Exercise | Sets x target | Load | Note |
|---|---|---|---|---|
| 1 | Squat | 3 x 8-12 | 10-15kg | |
| 2 | Hip Thrust | 3 x 8-12 | 15-25kg | |
| 3 | Leg Extension | 3 x 8-12 | 5-7.5kg/side | |
| 4 | Hamstring Curl | 3 x 8-12 | 5kg | Seated or standing; seated weight by feel. |
| 5 | Calf Raise | 3 x 8-12 | 20kg | |

Lower B

| # | Exercise | Sets x target | Load | Note |
|---|---|---|---|---|
| 1 | Bulgarian Split Squat | 3 x 8-12 /leg | 10-15kg | |
| 2 | Lumbar Extension | 3 x 8-12 | 10kg | |
| 3 | Adductors | 3 x 8-12 | 25-40kg | First to drop when short on time. |
| 4 | Abductors | 3 x 8-12 | 25-40kg | |
| 5 | Ab Crunch | 3 x 8-12 | 15kg | |

Expected order on Monday, Wednesday, Friday: week 1 Upper A, Lower A, Upper B; week 2 Lower B, Upper A, Lower A; week 3 Upper B, Lower B, Upper A; week 4 Lower A, Upper B, Lower B.

**Program B: PPLL.** Split `ppll`. Weekday grid with a 1-week cycle: Monday Push, Tuesday Legs, Thursday Pull, Friday Legs; Wednesday, Saturday and Sunday rest. No deload. Day type `hypertrophy`.

| Day | Exercises (all 2 x 8-12) |
|---|---|
| Push | Upper Chest 4kg/hand; Military Press 2kg/hand; Push-ups (incline); Tricep Above Head 5kg; Tricep Below Head 10kg |
| Pull | Pull-ups band 35+15; Mid Back Row 25kg; Kelso Shrug 7.5kg/hand; Lateral Raise 2kg/hand (note: on Pull day so the side delts are fresh); Bicep Curl 3kg/hand |
| Legs (Tuesday and Friday) | Squat 10-15kg; Bulgarian Split Squat 10-15kg /leg; Hip Thrust 15-25kg; Lumbar Extension 10kg; Leg Extension 5-7.5kg/side; Hamstring Curl 5kg; Adductors 25-40kg; Abductors 25-40kg; Calf Raise 20kg; Ab Crunch 15kg |

**Program C: Calisthenics 6-week cycle.** Split `calisthenics_cycle`. Weekday grid, 6-week cycle, deload in week 6. Legs and Test are `deloadExempt`. Program note: "If elbow or wrist pain lasts until the next session, switch to 3 sessions a week with a rest day between them."

| Week | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|---|---|---|---|---|---|---|---|
| 1 | Heavy (planche first) | rest | Light (front lever first) | rest | Heavy (front lever first) | Light (planche first) | Legs |
| 2 | Heavy (planche first) | rest | Dynamics | rest | Heavy (front lever first) | Light (planche first) | Legs |
| 3 | Heavy (planche first) | rest | Light (front lever first) | rest | Heavy (front lever first) | Light (planche first) | Legs |
| 4 | Heavy (planche first) | rest | Dynamics | rest | Heavy (front lever first) | Light (planche first) | Legs |
| 5 | Heavy (planche first) | rest | Light (front lever first) | rest | Heavy (front lever first) | Light (planche first) | Legs |
| 6 (deload) | Heavy (planche first) | rest | Light (front lever first) | rest | Heavy (front lever first) | Test | Legs |

Heavy (planche first), day type `skill_heavy`

| # | Exercise | Sets x target | Load | Note |
|---|---|---|---|---|
| 1 | Warm-up | checklist | | 10 min: wrists, scap push-ups, scap pull-ups, 1-2 easy sets of your working progression. |
| 2 | Planche Complex | 3 sets of 333 (hold, press, push-up) | band 25kg | Hold first, while fresh. Thinner band once every set is clean two sessions in a row. |
| 3 | Front Lever Complex | 3 sets of 555 (hold, touch, pull-up) | band 15kg | Same band rule. |
| 4 | Weak-point accessory (choice slot) | 3 sets | | Options below. |
| 5 | Weighted Dips | 2 x 8 | +25kg | Add 2.5kg when both sets end at 1-2 RIR. |
| 6 | Weighted Pull-ups | 2 x 6 | +20kg | Same rule. |
| 7 | Lateral Raise | 3 x 10-15 | | |
| 8 | Bicep Curl | 2 x 8-12 | | Strengthens the biceps tendon that straight-arm work loads. |

Heavy (front lever first): identical, with blocks 2 and 3 swapped.

Weak-point accessory options

| Option | Sets x target | Pick when |
|---|---|---|
| Planche Lean | 3 x 15-20s | You can't get your shoulders far enough in front of your hands. |
| Front Lever Raises | 3 x 5, no band, at your current hold progression | Your front lever line is fine but you can't hold horizontal. If 5 clean reps to horizontal don't happen, drop a progression; when 3 x 5 is easy, move up one. |
| Hollow Body Hold | 3 x 30s | Your body line breaks on either element. |

Light (front lever first), day type `skill_light`

| # | Exercise | Sets x target | Load | Note |
|---|---|---|---|---|
| 1 | Warm-up | checklist | | 5 min. |
| 2 | Front Lever Hold | 3-4 x 5-10s | no band | Hardest progression you hold clean. Stop a few seconds before your limit. Move up a progression after 4 x 10s clean. |
| 3 | Planche Hold | 3-4 x 5-10s | no band | Same. |

Light (planche first): identical, with blocks 2 and 3 swapped.

Dynamics, day type `dynamics`. Day note: "Start with the element you're learning, while fresh. Only clean attempts count. Rest fully between attempts and stop when grip or precision drops."

| # | Exercise | Sets x target | Note |
|---|---|---|---|
| 1 | Warm-up | checklist | 10 min: shoulders, wrists, swings, kips. |
| 2 | 360 | 4-6 attempts | |
| 3 | 540 | 4-6 attempts | |
| 4 | Shrimp Flip | 4-6 attempts | |

Test, day type `test`. Day note: "Planche first. Film yourself from the side. Write down the best time and what fails first, then pick next cycle's accessory."

| # | Exercise | Sets x target | Load | Rest | Note |
|---|---|---|---|---|---|
| 1 | Warm-up | checklist | | | 10 min, plus 2 easy sets of each element. |
| 2 | Planche Hold | 2 attempts, max | no band, current progression | 180s | |
| 3 | Front Lever Hold | 2 attempts, max | no band, current progression | 180s | |

Legs (Sunday), day type `hypertrophy`, `deloadExempt`

| # | Exercise | Sets x target | Load |
|---|---|---|---|
| 1 | Lumbar Extension | 3 x 10 | 15kg |
| 2 | Bulgarian Split Squat | 2 x 10 /leg | 20kg |
| 3 | Squat | 1 x 10 | 20kg |
| 4 | Hip Thrust | 2 x 10 | 25kg |
| 5 | Leg Extension | 2 x 10 | 12.5kg/side |
| 6 | Hamstring Curl | 2 x 10 | 10kg (standing) |
| 7 | Adductors | 2 x 10 | 80kg |
| 8 | Abductors | 2 x 10 | 50kg |
| 9 | Calf Raise | 2 x 10 | 50kg |
| 10 | Ab Crunch | 3 x 10 | 25kg |

Expected deload in week 6: Planche Complex 2 sets, Front Lever Complex 2, accessory 2, Weighted Dips 1, Weighted Pull-ups 1, Lateral Raise 2, Bicep Curl 1, light-day holds 2 (from 3-4), warm-ups unchanged. Legs and Test unchanged. Loads, bands and targets unchanged.

### 9.4 Generic templates for friends

No loads; the logger fills in last time's values after the first session. Day type `hypertrophy`.

**Full Body.** Split `full_body`. Rotation `[Full Body A, Full Body B]`, 3 sessions per week, preferred Monday, Wednesday, Friday.

| Day | Exercises |
|---|---|
| Full Body A | Barbell Back Squat 3 x 6-10; Bench Press 3 x 6-10; Barbell Row 3 x 8-12; Lateral Raise 2 x 12-15; Plank 3 x 30-45s |
| Full Body B | Romanian Deadlift 3 x 8-10; Overhead Press 3 x 6-10; Lat Pulldown 3 x 8-12; Leg Press 2 x 10-15; Bicep Curl 2 x 10-15 |

**Upper/Lower.** Split `upper_lower`. Weekday grid, 1-week cycle: Monday Upper 1, Tuesday Lower 1, Thursday Upper 2, Friday Lower 2.

| Day | Exercises |
|---|---|
| Upper 1 | Bench Press 3 x 6-10; Barbell Row 3 x 8-12; Overhead Press 2 x 8-12; Lat Pulldown 2 x 10-12; Triceps Pushdown 2 x 10-15; Bicep Curl 2 x 10-15 |
| Lower 1 | Barbell Back Squat 3 x 6-10; Romanian Deadlift 3 x 8-10; Leg Extension 2 x 10-15; Hamstring Curl 2 x 10-15; Calf Raise 3 x 10-15 |
| Upper 2 | Incline Dumbbell Press 3 x 8-12; Seated Cable Row 3 x 8-12; Pull-ups 2 x 6-10; Lateral Raise 3 x 12-15; Hammer Curl 2 x 10-12; Tricep Above Head 2 x 10-12 |
| Lower 2 | Deadlift 2 x 5; Leg Press 3 x 10-12; Bulgarian Split Squat 2 x 8-12 /leg; Hamstring Curl 2 x 10-15; Ab Crunch 3 x 10-15 |

**Push/Pull/Legs.** Split `ppl`. Rotation `[Push, Pull, Legs]`, 6 sessions per week.

| Day | Exercises |
|---|---|
| Push | Bench Press 3 x 6-10; Overhead Press 2 x 8-12; Incline Dumbbell Press 2 x 8-12; Lateral Raise 3 x 12-15; Triceps Pushdown 2 x 10-15 |
| Pull | Pull-ups 3 x 6-10; Barbell Row 3 x 8-12; Face Pull 2 x 12-15; Bicep Curl 2 x 10-15; Hammer Curl 2 x 10-12 |
| Legs | Barbell Back Squat 3 x 6-10; Romanian Deadlift 3 x 8-10; Leg Press 2 x 10-15; Hamstring Curl 2 x 10-15; Calf Raise 3 x 10-15 |

Every split type also offers a blank template.

## 10. Architecture

### 10.1 Stack

- Runtime: Vite, React (the version Ionic React 9 supports), TypeScript in strict mode, Ionic React 9 set up with `setupIonicReact({ mode: 'ios' })`, Dexie with dexie-react-hooks, Zod, date-fns, fflate, Recharts, vite-plugin-pwa, and @vite-pwa/assets-generator for icons and splash screens.
- Dev: Vitest, @testing-library/react, fake-indexeddb, Playwright, ESLint with typescript-eslint, Prettier.

### 10.2 Layout

```
src/
  domain/     pure TypeScript: types, schedule, deload, effort, stats, PRs, backup and share schemas (Zod), template fixtures
  data/       Dexie database, migrations, repositories, first-launch seeding
  features/   today/ workout/ programs/ library/ history/ progress/ settings/
  ui/         shared components: steppers, set sheet, band picker, stopwatch, chart wrappers
  pwa/        service worker registration, install detection, wake lock, audio
  app/        shell, tabs, routing, error boundary
tests/e2e/    Playwright specs
```

### 10.3 Rules

- `src/domain` imports nothing from React, Ionic, Dexie or browser APIs, and never calls `Date.now()`. Callers pass dates in.
- Features read and write only through `src/data` repositories. Live data comes from Dexie `liveQuery` / `useLiveQuery`.
- Ids from `crypto.randomUUID()`. Timestamps in epoch ms. Calendar dates as local `yyyy-mm-dd` strings. Week math with date-fns and `weekStartsOn: 1`.
- The Dexie schema is versioned from day one. Every schema change ships a migration and bumps the backup `schemaVersion`.
- Hash-based routing (`IonReactHashRouter` or its Ionic 9 equivalent) so deep links work on GitHub Pages. Vite `base`, manifest `scope` and `start_url` all match the repo path.
- vite-plugin-pwa with `registerType: 'prompt'`: offline app shell, an "Update available" toast, and no reload while a session is active.
- Manifest: `display: standalone`, portrait, light and dark theme colors, 192 and 512 icons plus maskable, a 180px apple-touch-icon, iOS splash screens.
- No runtime network requests until phase 2, no analytics, no web fonts (system font through Ionic).
- Lazy-load the Progress tab so the charts don't slow the first load.
- Accessibility: 44pt touch targets, labels on icon-only buttons, layouts that hold up at larger text sizes.

### 10.4 Deploy and device testing

- GitHub Actions on every push to main: install, lint, typecheck, unit tests, build, deploy to GitHub Pages.
- Before a deploy, `vite --host` over the LAN is enough for UI checks on the iPhone. Service worker, install, Wake Lock and Web Share need HTTPS, so test those on the GitHub Pages URL or through a free Cloudflare Tunnel.

## 11. Testing and acceptance

Unit tests with Vitest, data tests with fake-indexeddb, component tests with Testing Library, end-to-end tests with Playwright on WebKit with an iPhone device profile and a mocked clock.

Domain and data acceptance tests (all required):

1. Program A: 12 finished sessions in a row follow Upper A, Lower A, Upper B, Lower B, and the Monday/Wednesday/Friday weeks match section 9.3.
2. A rotation `[Push, Legs, Pull, Legs]` gives the right next day after either Legs session (uses `rotationIndex`).
3. Program C with anchor Monday D: D+1 is rest, D+2 is Light (front lever first), D+9 is Dynamics, D+40 is Test, every Sunday is Legs, D+42 is cycle 2 week 1 Heavy (planche first).
4. The week 6 deload matches the expected list in section 9.3, with Legs and Test unchanged and the deload note added.
5. "Deload this week" applies the same transform to that week only.
6. A pick saved by the test flow in cycle 1 applies in cycle 2, and a slot with no pick resolves to "needs pick".
7. RPE 8.5 is saved as RIR 1.5, and RIR 2 displays as RPE 8.
8. e1RM of 25kg x 10 at RIR 2 is 35.0; 25kg x 14 at RIR 2 is excluded.
9. With bodyweight 40kg, Weighted Dips at +25kg have an effective load of 65kg; Pull-ups with bands 35+15 have band level 50 and no effective load.
10. 3 working sets of Pull-ups plus 1 warm-up set give lats 3, biceps 1.5, upper_back 1.5.
11. Backup then restore gives deep-equal data, and the pre-restore snapshot can be restored.
12. Every built-in template survives a share-code round trip; import creates fresh ids and reuses existing exercises by name.
13. Editing a program after a session leaves that session's `planSnapshot` unchanged.
14. A set that beats the previous best e1RM is flagged as a PR, and so is a clean hold longer than the previous best at the same level.

End-to-end flows:

1. Fresh start, activate Program C, Today shows the right day for a mocked date.
2. Log a full Heavy day (warm-up, both complexes, accessory pick, weighted dips and pull-ups, lateral raise, curls); the rest timer runs; finish; summary; the session shows in History.
3. Reload mid-workout; Resume restores the sets and the remaining rest time.
4. Export a backup, clear storage, restore, same data.
5. Share Program A as a code, import it in a fresh browser context, all its days are there.

Manual check on my iPhone at the end of Milestone 6: install from GitHub Pages, use it in airplane mode, screen stays on during a workout, sound plays at the end of rest, storage shows as persistent, backup goes to Files through the share sheet, restore from Files works.

## 12. Writing rules

- UI text: short, plain English, sentence case. Never use em dashes or en dashes; use a hyphen, colon, comma or a new sentence. No hype words, no exclamation marks.
- Number formats: "3 x 8-12", "35+15kg", "4kg/hand", "12.5kg/side", "Week 3 of 6".
- README, plans, commit messages and messages to me follow the same rules. If my humanizer skill is installed, run prose through it.

## 13. Milestones

Every milestone ends with typecheck, lint and all tests green, a code review, and a short report to me.

1. **Domain model and fixtures.** Types, schedule rules, deload, choice slots, effort conversion, stats and PR formulas, backup and share-code schemas, all templates from section 9 as fixtures. Done when acceptance tests 1-10 and 14, plus the codec part of 12, pass. No UI.
2. **Data layer and backup.** Dexie schema v1, repositories, first-launch seeding, persistence of the active session and rest timer, backup, restore with undo, CSV export, program share and import. Done when acceptance tests 11-13 pass against fake-indexeddb.
3. **Shell, library and programs.** Ionic shell with tabs, Settings, exercise library, program list, template picker, program editor, activation, share and import screens.
4. **Today, logger and rest timer.** Today, the logger for every tracking type, supersets, swaps, choice-slot picks, rest timer, Wake Lock, sound, resume, finish summary, test flow. Done when end-to-end flows 1-3 pass.
5. **History and progress.** Calendar, session view and edit, every stat and chart in section 7, PR flags, bodyweight.
6. **PWA and deploy.** Manifest, icons and splash screens, service worker with update prompt, install banner, persistent storage request, backup reminder, error boundary export, GitHub Actions deploy to Pages. Done when end-to-end flows 4-5 pass and the manual iPhone check passes.

## 14. Decisions already made

| Decision | Reason |
|---|---|
| PWA, not a native app | Free for me and my friends. Native distribution needs the $99/year Apple account, Expo Go on iOS can't open projects from other accounts, and free sideloading expires every 7 days. |
| No accounts, server or social features | Everyone keeps their own data. Sharing programs by code or file is enough. |
| Log only, no progression suggestions | My choice. Progression rules live as block notes. |
| Native iOS look with Ionic React 9 in iOS mode | I picked the inset grouped list layout. |
| RIR stored, RPE available as input | One stored value, both views. |
| Bands as levels, never subtracted from bodyweight | Band labels are resistance ratings, not assistance. |
| English UI, kg only | Exercise names are already in English and everyone uses kg. |
| Rest alert inside the app in v1 | A lock screen alert needs a push server, so it waits for phase 2. |
| No Apple Health, no Live Activity | Web apps can't use them. |

## 15. Phase 2: lock screen rest alert

Not part of v1. Plan it only after Milestone 6 is done.

- A Cloudflare Worker on the Workers Free plan with one Durable Object per push subscription. Durable Objects are on the free plan; confirm in Cloudflare's docs that Durable Object alarms are too, and ask me if they aren't.
- Endpoints: `POST /timers` with `{ subscription, timerId, fireAt }` stores the timer and sets an alarm. `DELETE /timers/:timerId` cancels it (Skip, or before rescheduling after +15s). When the alarm fires, the Worker sends a Web Push signed with VAPID that just says "Rest over".
- Privacy: the phone sends only the push subscription and the fire time. No workout data leaves the device.
- Client: Settings gets "Lock screen alerts". The permission request happens on that tap and only works in the home screen app. After subscribing with the VAPID public key, the app schedules a timer on every Done and cancels it on Skip or +15s.
- The service worker's push handler always calls `showNotification` inside `event.waitUntil`, because iOS can revoke subscriptions that receive pushes without showing a notification.
- Limits: one pending timer per subscription, `fireAt` at most 15 minutes ahead.
- If the network is down, the in-app timer still works. The push is best effort.
