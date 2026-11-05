# Milestone 5 plan: History and Progress

Spec: `docs/superpowers/specs/2026-10-30-workout-tracker-design.md` (sections 6.5 to 6.7, 7, 10.3, 11, 13).
Builds on Milestones 1 to 4.

Goal: finished workouts can be found, read, corrected and deleted, and the logs turn into every stat and chart in section 7.

Done when: `npm run check` is green, all end-to-end tests pass on iPhone WebKit, and flow 2 now ends with the session showing in History.

Branch: `milestone-5-history-progress`. One commit per task.

## What the docs and a spike confirmed

Read the Recharts docs (installation, sizes, animations, performance, the LineChart, Tooltip and ResponsiveContainer API pages, the 3.0 migration guide) and the npm registry entry. Ran a throwaway app with Recharts on React 19.3, Vite 6, jsdom 26 and Playwright 1.64 on this machine, on Node 20.12.

- Latest stable is 3.10.1, which GitHub lists as 25 July. npm also has a 3.11 canary, which I will not use.
- Peer dependencies accept React 19. It also needs `react-is`, which npm installs by itself at 19.3.1. Redux Toolkit, react-redux and immer come in as Recharts' own dependencies.
- It installs with npm 10.9.3 on Node 20.12, and the build works.
- Lazy loading works. In the spike, the charts landed in their own chunk of 115 kB gzipped. Nothing from Recharts stayed in the main chunk.
- The `responsive` prop on a chart replaces `ResponsiveContainer`: `<LineChart responsive style={{ width: '100%', height: 200 }}>`. The chart resized correctly after being hidden, resized and shown again, which is what happens to a page in an Ionic tab.
- Animation is off per series with `isAnimationActive={false}`.
- In the iPhone WebKit profile, a tap opens the tooltip with `trigger="click"`, and a second tap moves it.
- A horizontal bar chart (`layout="vertical"`) with `ReferenceArea` draws all 18 muscle names at phone width, with the reference band behind the bars.
- `reversed` on `YAxis` and `connectNulls` on `Line` both work, with no console errors.
- In jsdom, charts render an empty frame without a `ResizeObserver` stub and without crashing, so UI tests assert on the text beside a chart, and the numbers are tested in the domain.
- Not tested: a time-scaled X axis, which Task 0 checks. Also scrolling a page by dragging on a chart, since Playwright can't reproduce an iPhone swipe. Recharts sets no `touch-action`, so it should scroll, and this joins your iPhone check.

## Dependencies

Only `recharts` 3.10.1, which section 10 names. No calendar or date picker library.

## Data model

No changes: no schema bump, and the backup format stays as it is.

## Decisions for this milestone

1. Pages stay in the main chunk and only their chart sections load lazily, through `lazy` and `Suspense` inside the page. I did not test a lazy route inside Ionic's outlet, and this way avoids that risk while keeping Recharts out of the first load. The library's exercise page gets its charts the same way.
2. Stats stay pure. One live query, `loadStatsData`, reads finished sessions, sets, exercises, bands and bodyweight, and the existing domain functions do the work. Task 9 measures this with two years of generated data.
3. Editing reuses the logger's `ExerciseCard` and `SetSheet`, with the set sheet logic moved into a shared hook. Editing never starts the rest timer or touches the wake lock.
4. Edit covers every set value, warm-up or working, adding and deleting sets, session name, notes and duration. Duration matters because a workout finished late would otherwise skew the stats. The date stays fixed, since the schedule and rotation read it.
5. PRs are always derived, never stored, so editing an old session corrects them. A new `prHistory` replays an exercise's sessions in finish order with `detectPrs`, and `currentRecords` gives the standing bests.
6. PR flags show on the session page, in Recent PRs on Progress, and in Records on the exercise page. The History list shows none, because it would have to replay every exercise for each month.
7. The calendar is a small component on a pure `monthGrid`, Monday first, with 44pt day buttons. The number keeps normal text color and a color bar sits under it, because three of the light colors fall under 3:1 on white. A day with two sessions shows both bars. Tapping a day filters the list below.
8. Color is never the only signal. The eight colors pass the validator for neighbors in both modes against the app's card backgrounds (#ffffff and #1c1c1e), but not for every pair, and any two types can sit side by side in a month. So the legend shows the types in that month, each list row names its day, and each day button has a full label such as "Tuesday 3 November, Heavy".
9. Chart colors are CSS tokens on `:root`, with their own dark steps from the same palette. Single series use slot 1. Hold charts use one line per level, colored by ladder order so a level keeps its color. A custom ladder past eight levels folds into "Other".
10. No chart has two Y axes. Complex exercises get one chart for band level and one for clean share. Band level axes are reversed, so up means harder, and the chart says so.
11. Each chart has a text line above it with the latest and best values, because a tap should never be the only way to read a number. The exercise's set history and the bodyweight list are the full tables. Muscle bars carry their value at the end of the bar, since a phone has no hover.
12. All X axes use real dates, so a two-week gap looks like one. Dates become a day count through a domain helper, which avoids time zone errors. If Task 0 finds this fails, I will fall back to evenly spaced sessions and tell you.
13. Consistency covers the last 8 weeks, starting no earlier than the first finished session. Finished counts every session, and planned comes from the active program. A week before you switched programs is compared with the current plan, which is a known limit. Without an active program, only finished shows.
14. Weekly sets default to this week, with a week stepper that stops at the current week and a 4-week average switch. All 18 muscles stay in body order, so zeros stay visible and bars don't jump between weeks. The band comes from `settings.muscleReference`.
15. Exercise history shows the latest 20 sessions, then a Show more button.
16. Deleting a test session removes its test results but keeps the pick already saved for the next cycle. The spec doesn't cover this. A pick shapes a program going forward, and you can change it in the program.

## Stats by tracking type

| Tracking type     | Charts on the exercise page                                                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `weight_reps`     | e1RM trend, heaviest load                                                                                                                                  |
| `bodyweight_reps` | e1RM trend and effective load when weighted, band level when banded, best reps when plain. Without a bodyweight entry the load chart is titled "Added kg". |
| `hold`            | best clean hold per progression level                                                                                                                      |
| `complex`         | band level, share of clean sets                                                                                                                            |
| `attempts`        | clean attempts per session, with total attempts as a second line                                                                                           |
| `checklist`       | none, only the history                                                                                                                                     |

## File layout

```
src/domain/
  calendar.ts          monthGrid, sessions by day, month steps
  exercise-series.ts   the series for each tracking type, hold levels as chart rows
  prs.ts               + prHistory, currentRecords
  consistency.ts       + consistencyWeeks, averageDuration
  format.ts            + short dates, day labels, chart readouts, record lines
src/data/
  history.ts           finished sessions by month
  stats.ts             loadStatsData, exercise set history
  sessions.ts          + duration in updateSession
src/ui/
  charts/              ChartFrame, TrendChart, BarsChart, tokens (lazy only)
src/features/
  history/             HistoryPage, MonthCalendar, SessionPage, SessionEditPage
  workout/             useSetEditor (moved out of WorkoutPage)
  progress/            ProgressPage, ProgressContent, ConsistencySection, MuscleSection,
                       BodyweightPage, SkillsPage, ExercisesPage, ExerciseCharts
  library/             ExerciseDetailPage + records, charts, set history
tests/e2e/             history.spec.ts, flows.spec.ts + the History check
```

## Routes

```
/tabs/history                       calendar and list
/tabs/history/:id                   session, read-only
/tabs/history/:id/edit              session editor
/tabs/progress                      consistency, weekly sets, recent PRs, links
/tabs/progress/bodyweight           chart and entries
/tabs/progress/skills               holds, complexes, test results
/tabs/progress/exercises            exercises with logged sets
/tabs/progress/exercises/:exerciseId   the exercise page, with back to this list
```

## Tasks

### Task 0: Recharts setup

- Add `recharts`. `ChartFrame` and `TrendChart` with the tokens, the tooltip on tap, and animation off.
- Keep a test page in the build for this task only, to check the time-scaled X axis on WebKit in light and dark.
- `ProgressPage` becomes the eager shell with a lazy section. Build, then confirm Recharts is outside the main chunk.
- Tests: the page shows its loading state, then the section. The empty state shows with no finished sessions.
- Commit: `chore: add Recharts and the chart frame`.

### Task 1: history and calendar logic (domain, test first)

- `calendar.ts` and the date formats.
- Tests: a month starting on Monday, on Sunday, February in a leap year, and the DST months in Bucharest; two sessions on one day; active sessions left out; day labels.
- Commit: `feat(domain): add the month calendar`.

### Task 2: stats series and PR replay (domain, test first)

- `exercise-series.ts`, `prHistory`, `currentRecords`, `consistencyWeeks`, `averageDuration`.
- Tests: a chart set per tracking type; warm-ups and unfinished sessions excluded; added kg alone without a bodyweight entry; hold rows keep ladder order; an edited old session changes the later PRs; a first log gives no PR; the consistency window with no sessions, a rotation, and a weekday program.
- Commit: `feat(domain): add exercise series, PR replay and consistency weeks`.

### Task 3: data for History and Progress

- `history.ts`, `stats.ts`, and `updateSession` taking a new duration. A duration under one minute is refused.
- Tests against fake-indexeddb: month ranges, active sessions hidden, the set history paging, duration.
- Commit: `feat(data): add history and stats queries`.

### Task 4: History screen

- `HistoryPage` with `MonthCalendar`, month steps, legend, the session list and day filter. Day type tokens in `theme.css`.
- Tests: bars on the right days, the day filter and clearing it, month steps, the empty month.
- Commit: `feat(history): add the calendar and session list`.

### Task 5: session view and edit

- `SessionPage`: read-only sets, duration, notes, PR flags on sets, the plan note, Edit and Delete with a confirm. Sets never logged stay hidden here.
- Move set sheet logic into `useSetEditor`, with the logger tests staying green unchanged.
- `SessionEditPage`: cards with the sheet, name, notes, duration. Sets never logged show here, so a forgotten set can be filled in.
- Tests: editing a value shows in the view and changes the PRs; no rest timer starts; delete asks first and removes the session; the logger still behaves the same.
- Commit: `feat(history): add session view, edit and delete`.

### Task 6: Progress overview

- Consistency: streak, this week "2 of 4", average duration, planned and finished bars.
- Weekly sets per muscle with the week stepper, 4-week average and reference band.
- Recent PRs, and links to the sub pages.
- Tests: the readout text for each section, the stepper stopping at this week, the average matching the domain.
- Commit: `feat(progress): add consistency, weekly sets and recent PRs`.

### Task 7: bodyweight and skills

- `BodyweightPage`: entries as dots, the 7-day average as a line, add for any date, swipe to delete, list newest first. Today's quick entry stays.
- `SkillsPage`: best clean hold per level, band level and clean share for each complex, and the test results table.
- Tests: add and delete an entry, a same-day entry replacing the old one, the test results rows, the empty states.
- Commit: `feat(progress): add bodyweight and skills`.

### Task 8: exercise pages

- `ExercisesPage` lists exercises with logged sets. `ExerciseCharts` shows the table above. The exercise page gains Records and the full set history. Rows open the session in History.
- The charts load lazily on the library route as well.
- Tests: the right charts per tracking type, records, Show more, an exercise with no logs.
- Commit: `feat(progress): add exercise charts, records and set history`.

### Task 9: end-to-end, verification and review

- Flow 2 finishes in History: the day is marked, the session opens, and its sets are there.
- New `history.spec.ts`: log a short workout, correct a set in History, see the change, delete a session, open a chart on Progress and tap it.
- Generate a backup with 12 weeks and one with two years of data, restore each in the browser pane, and go through every screen at iPhone size in light and dark. Time Progress with the two-year data. If it is slow, cache per week before moving on.
- Check all chart text for overlaps, 44pt targets and larger text sizes, and go through the dataviz anti-pattern list.
- `npm run check`, `npm run build` and `npm run test:e2e` green, read the output. Confirm the main chunk holds no Recharts.
- Grep for dashes in UI text.
- Code review of the branch, fix findings, report with the steps to try it on your iPhone. Merge waits for you.
