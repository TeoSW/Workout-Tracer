# Milestone 4 plan: Today, logger and rest timer

Spec: `docs/superpowers/specs/2026-10-30-workout-tracker-design.md` (sections 6.1 to 6.4, 11, 13).
Builds on Milestones 1 to 3.

Goal: you can run a real workout. Today shows what is next, the logger handles every tracking type, the rest timer and screen stay reliable, a reload loses nothing, and finishing shows a summary with PRs.

Done when: `npm run check` is green and end-to-end flows 1 to 3 from section 11 pass on Playwright WebKit with an iPhone profile.

Branch: `milestone-4-logger`. One commit per task.

## What the docs and a spike confirmed

Read the Playwright docs (intro, browsers, clock, emulation, web server, configuration, locators). Ran a throwaway Ionic app on Playwright 1.64 with WebKit on this machine, on Node 20.12.

- **It works here**: iPhone profile, tap, click, a sheet modal opening and closing, and IndexedDB surviving a reload all pass.
- **Not officially supported**: the docs list Node 22+, and neither Windows 10 nor Arch Linux is on the supported OS list. It runs on Windows 10 today. Arch is untested, so end-to-end tests may not run there. GitHub Actions on Ubuntu is supported, which is where they will run in Milestone 6.
- `devices['iPhone 13']` selects WebKit and gives a 390 wide layout. It needs the viewport meta tag, which `index.html` already has; without it `tap()` fails.
- Clock: `page.clock.install({ time })` before `goto`. Move time with `fastForward`, then `resume` so timers keep running. `setFixedTime` also works for tests that only need today's date.
- Locators go through open shadow DOM, so `getByRole('button', { name })` works on Ionic buttons.
- Use a `baseURL` ending in `/workout-tracker/` and relative paths such as `./#/tabs/today`.
- A `<div slot="bottom">` before `IonTabBar` inside `IonTabs` sits exactly on top of the tab bar. That is the rest bar's home, so it stays visible on every tab.
- Sheet modal content renders in jsdom, so component tests can reach it.
- `AudioContext` does not exist in this WebKit build, and `wakeLock` does. Both stay feature-detected, and sound is checked by unit test and by hand on the iPhone.

## Dependencies

Only `@playwright/test`, which the spec names. WebKit installs with `npx playwright install webkit`, into the user cache, not the project.

## Decisions for this milestone

1. **The logger sits in the Today tab** at `/tabs/today/workout`, so tabs stay usable mid-workout and the rest bar keeps running.
2. **Set editing logic is pure.** `src/domain/set-draft.ts` builds a draft from last time's values or the plan, and turns it into a set patch. The sheet only displays it, so every tracking type is tested without UI.
3. **"Last time" follows section 6.2 exactly:** same exercise and set number in the latest finished session of any program, then the last set of that exercise in that session, then the plan target's lower end.
4. **Rest logic is pure.** `restAfterSet` returns the seconds to rest, or null inside a superset round, where rest starts after the last exercise of the round.
5. **Sound is one short tone from Web Audio**, created on the Start tap. There is no audio file to cache.
6. **Marking a set done starts the timer.** A set already done, when edited from History or re-saved, does not.
7. **Discard workout** is added to the header menu, with a confirm. A session started by mistake needs a way out, and `deleteSession` already does the work.

## File layout

```
src/domain/
  last-time.ts      the section 6.2 lookup
  set-draft.ts      draft from last time or plan, draft to set patch, validity
  rest-plan.ts      rest seconds after a set, superset rounds
  session-summary.ts  duration, working sets, PR lines
  format.ts         + formatSetResult, formatLastTime, formatPr
src/data/
  sessions.ts       + lastSessionWith(exerciseId), discard
src/pwa/
  wake-lock.ts      request, re-request on visibilitychange, release
  audio.ts          unlock on tap, play the tone
src/features/
  today/            TodayPage, PickDayPage
  workout/          WorkoutPage, ExerciseCard, SupersetCard, SetRow, SetSheet,
                    StopwatchField, AttemptsField, ComplexField, ChoiceCard,
                    ExerciseInfoSheet, AddExercisePage, SummaryPage, TestFlowPage
  rest/             RestBar, useRestTimer
tests/e2e/          flow-1.spec.ts, flow-2.spec.ts, flow-3.spec.ts, helpers.ts
```

## Routes

```
/tabs/today                 what is next
/tabs/today/pick-day        start another day
/tabs/today/workout         the logger
/tabs/today/workout/add     add an exercise
/tabs/today/summary/:id     finish summary
/tabs/today/test/:id        test flow
```

## Tasks

### Task 0: Playwright setup

- Add `@playwright/test`. `playwright.config.ts` with one WebKit iPhone project, `testDir: 'tests/e2e'`, `baseURL`, and a `webServer` that builds and runs `vite preview` on port 4173.
- Scripts `test:e2e`. `.gitignore` for `test-results` and `playwright-report`. `npm run check` stays fast and does not run it.
- Smoke test: the app opens on Today.
- Commit: `chore: add Playwright with an iPhone WebKit project`.

### Task 1: last time, drafts, rest plan (domain, test first)

- `last-time.ts`, `set-draft.ts`, `rest-plan.ts`, and the new formats: "Set 1 · 10 reps · RIR 2", "last: 35+15 x 9", "4 of 6 clean", "Advanced tuck · 8s · clean".
- Tests: each step of the lookup order; a draft per tracking type; RPE input stored as RIR; added kg and bands never both; superset rest only after the last exercise of a round; a block's rest over the exercise default.
- Commit: `feat(domain): add last time lookup, set drafts and rest plan`.

### Task 2: Today

- Next workout, "Week 3 of 6", Deload badge when it applies to that day, Start. Rest days, done days with the next day, Resume card, Start another day, Empty workout, quick bodyweight, a button to pick a program when none is active.
- Tests: one per state, plus Start creating a session and opening the logger.
- Commit: `feat(today): add the Today screen`.

### Task 3: pwa helpers

- `wake-lock.ts`, `audio.ts`, each feature-detected, with a one-time tip when Wake Lock is missing.
- Tests: request and release, re-request on `visibilitychange`, no crash when unsupported; the tone plays only after unlock.
- Commit: `feat(pwa): add wake lock and rest sound`.

### Task 4: logger cards and set rows

- `WorkoutPage` with elapsed time, one inset card per exercise, plan line, info sheet with cues, notes and alternatives. Done rows and pending rows with last time's values. Swipe to delete or toggle warm-up. Exercise action sheet: add set, swap, note, move, remove. "up to N" next to Add set. Superset cards. Choice cards with `pickWhen`. Add exercise page. Discard workout.
- Tests: rows follow the plan; swipe actions; swap only changes this session; choice pick creates rows and saves the pick.
- Commit: `feat(workout): add logger cards and set rows`.

### Task 5: set sheet for every tracking type

- Sheet prefilled from the draft, with steppers, band picker and effort chips. Hold: stopwatch, level, clean. Complex: a stepper per part, band, level, clean. Attempts: "+ clean", "+ miss", undo. Checklist: one toggle. A repeat set takes one tap on Done.
- Tests: logging one set of each type; RPE mode; the prefill.
- Commit: `feat(workout): add the set sheet`.

### Task 6: rest timer

- `RestBar` above the tab bar: remaining time, +15s, Skip. Computed from `endsAt`. At zero it plays the tone and flashes; if the app was in the background it shows "Rest over" on return.
- Tests: starts on done with the right seconds; +15s; Skip; right value after a reload; no start inside a superset round.
- Commit: `feat(rest): add the rest timer bar`.

### Task 7: finish, summary, test flow

- Finish with a confirm, summary with duration, working sets, new PRs and a notes field. Release the wake lock. A test day continues to the test flow: confirm best clean hold, level and note for each hold, then pick next cycle's option.
- Tests: summary numbers; a PR line appears; the test flow saves results and the pick for the next cycle.
- Commit: `feat(workout): add finish summary and test flow`.

### Task 8: end-to-end flows 1 to 3

- Flow 1: fresh start, activate Program C, Today shows the right day for a mocked date.
- Flow 2: log a full Heavy day (warm-up, both complexes, accessory pick, weighted dips and pull-ups, lateral raise, curls), the rest timer runs, finish, summary. History does not exist until Milestone 5, so this flow checks the finished session through the summary and Today's done state, and gains its History check in Milestone 5.
- Flow 3: reload mid-workout, Resume restores the sets and the remaining rest time.
- Commit: `test: add end-to-end flows 1 to 3`.

### Task 9: verification and review

- `npm run check`, `npm run build` and `npm run test:e2e` green, read the output.
- Go through a full workout in the browser pane at iPhone size, light and dark. Check 44pt targets and text.
- Grep for dashes in UI text.
- Code review of the branch, fix findings, report with the steps to try it on your iPhone. Merge waits for you.
