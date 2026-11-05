# Milestone 3 plan: shell, library and programs

Spec: `docs/superpowers/specs/2026-10-30-workout-tracker-design.md` (sections 6, 6.5, 6.8, 10, 12, 13).
Builds on Milestones 1 and 2 (`src/domain`, `src/data`).

Goal: the app opens on an iPhone. It has the five tabs, working Settings, the exercise library, and the full programs area: list, template picker, editor, activation, share and import. Today, History and Progress are empty screens until Milestones 4 and 5.

Done when: `npm run check` is green, `npm run build` works, and the app opens and works over the LAN on a phone-sized screen. This milestone has no end-to-end tests of its own; Playwright arrives in Milestone 4.

Branch: `milestone-3-shell`. One commit per task.

## What the docs and a spike confirmed

Read the Ionic 9 docs (9.0 upgrade guide, add-to-existing, navigation, dark mode, overlays, modal, item sliding, list, title, testing). Built a throwaway tabs app with these versions on Node 20.12: typecheck, Vite build and a jsdom render through the hash route all pass.

- `setupIonicReact({ mode: 'ios' })` is still the setup call, and must run before any Ionic component renders.
- `IonReactHashRouter` is exported by `@ionic/react-router` 9. **Ionic 9 supports React Router 6 only**, so we stay on 6.30.
- Routes use `element={<X />}`, not `component`. Nested routes need `/*`. `<Redirect>` is `<Navigate replace />`, and `useHistory` is `useNavigate` or `useIonRouter`. Do not use `navigate(-1)` inside tabs; use `useIonRouter().goBack()`.
- Do not route across tabs. Pages that belong to a tab stay under that tab's path. Nested outlets need `<IonRouterOutlet ionPage>`.
- Dark mode following the system is one import: `@ionic/react/css/palettes/dark.system.css`.
- Sheet modal: `breakpoints`, `initialBreakpoint`. `isOpen` is one-way, so set it back in `onDidDismiss`.
- Overlays: `useIonAlert`, `useIonActionSheet`, `useIonToast` return `[present, dismiss]`. The docs disagree on the toast and action sheet form, so the first use is checked by a test.
- Large titles: `IonHeader translucent` with `IonTitle`, plus `IonHeader collapse="condense"` with `IonTitle size="large"` inside `IonContent fullscreen`.
- Tests: `setupIonicReact()` in the setup file, and a `window.matchMedia` stub, since jsdom has none.
- The spike's bundle is 1.1 MB of JS before gzip. Fine for an installed app, and the Progress tab stays lazy in Milestone 5.

Not verified by the docs: the `expandable` prop on `IonItemOption`, and the behaviour of overlays in jsdom. Keep logic out of overlays so it can be tested without them.

## New dependencies (need your approval, spec instruction 5)

Named in the spec: `react`, `react-dom`, `@ionic/react`, `dexie-react-hooks`, `@testing-library/react`.

Not named, and needed:

| Package                                                                            | Why                                                                                            |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `@ionic/react-router`, `react-router`, `react-router-dom` (6)                      | Hash routing, spec 10.3 asks for `IonReactHashRouter`                                          |
| `ionicons`                                                                         | Tab and button icons. Already installed as a dependency of Ionic; listed so imports are direct |
| `@vitejs/plugin-react` (4)                                                         | JSX in Vite                                                                                    |
| `jsdom` (26)                                                                       | The browser environment for component tests                                                    |
| `@testing-library/dom`, `@testing-library/jest-dom`, `@testing-library/user-event` | Required peer, DOM matchers, and realistic taps in tests                                       |
| `@types/react`, `@types/react-dom`                                                 | Types                                                                                          |

All are dev-time or bundled. None adds a runtime network call.

## Decisions for this milestone

1. **Node 20.12 stays workable.** Vite 6, `@vitejs/plugin-react` 4 and jsdom 26 run on it. Node 24 is still worth installing, but nothing here waits for it.
2. **`src/app` owns startup:** seed, then render. A `DataProvider` gives features the `DataContext`, and `useLive(query, deps)` wraps `useLiveQuery`. Features never touch `db` directly.
3. **Formatting is pure and tested.** `src/domain/format.ts` produces every number format in spec section 12: "3 x 8-12", "35+15kg", "4kg/hand", "12.5kg/side", "Week 3 of 6", and the plan line under an exercise.
4. **Editor changes are pure functions.** `src/domain/program-edit.ts` handles resizing a cycle, setting a grid day, rotation edits, and moving, adding and removing blocks. Screens call these and save the result, so the rules are tested without the UI.
5. **Saving files lives in `src/pwa/files.ts`**: Web Share with files when `navigator.canShare({ files })` allows it, otherwise a download link. Feature-detected. Reading a picked file sits next to it.
6. **Storage status is read-only here.** Settings shows `navigator.storage.persisted()` and `estimate()` when available. Requesting persistence on first standalone launch is Milestone 6.
7. **`BASE_PATH = '/workout-tracker/'`** is one constant for now, used by Vite. It must match the GitHub repo name, which we settle in Milestone 6.
8. **Two test environments**, as Vitest projects: `tests/unit` stays in Node, `tests/ui` runs in jsdom.
9. **No extra ESLint plugins.** The hooks plugin is not in the spec, so I won't add it without asking.

## File layout

```
index.html
vite.config.ts
src/
  app/        main.tsx, App.tsx, Tabs.tsx, DataProvider.tsx, theme.css
  ui/         PageShell, Stepper, labels.ts, useConfirm, ExercisePicker, BandPicker
  pwa/        files.ts, storage.ts
  features/
    settings/ SettingsPage, BandsPage, BackupSection
    library/  LibraryPage, ExerciseFormPage, ExerciseDetailPage
    programs/ ProgramsPage, NewProgramPage, ProgramEditorPage, DayEditorPage,
              BlockEditor, ShareProgramPage, ImportProgramPage
    today/ history/ progress/   empty pages for now
tests/
  unit/domain/   format.test.ts, program-edit.test.ts
  ui/            setup.ts, helpers.tsx, one file per feature
```

## Routes

Everything sits under its tab so tab switching keeps its place.

```
/tabs/today  /tabs/history  /tabs/progress
/tabs/settings   /tabs/settings/bands
/tabs/programs   /tabs/programs/new   /tabs/programs/import
/tabs/programs/:id   /tabs/programs/:id/days/:dayId   /tabs/programs/:id/share
/tabs/programs/library   /tabs/programs/library/new
/tabs/programs/library/:exerciseId   /tabs/programs/library/:exerciseId/edit
```

## Tasks

### Task 0: scaffold and shell

- Install the dependencies above with `npx -y npm@10.9.3 install`.
- `index.html`, `vite.config.ts` (with `BASE_PATH`), `tsconfig.json` (DOM libs, `jsx`), Vitest projects, scripts `dev`, `build`, `preview`. All cross-platform.
- ESLint: `src/features`, `src/ui`, `src/app` must not import `dexie` or `src/data/db`, so screens only use repositories.
- `App`, `Tabs`, `DataProvider`, `theme.css`. Five tabs with icons, empty pages with large titles.
- Tests: the app seeds and shows Today; `#/tabs/settings` opens Settings.
- Commit: `feat(app): add Ionic shell with five tabs and data provider`.

### Task 1: formatting and editor rules (domain, test first)

- `format.ts`: `formatKg`, `formatLoad(target, exercise)`, `formatBands`, `formatSetsReps(block)`, `formatPlanLine(block, exercise, bands)`, `formatCycleWeek`, `formatDuration`.
- `program-edit.ts`: `resizeCycle` (grows the grid with rest weeks, shrinks it and drops deload weeks past the end), `setGridDay`, `toggleDeloadWeek`, `addRotationDay`, `removeRotationEntry`, `moveRotationEntry`, `addExerciseBlock`, `addChoiceBlock`, `removeBlock`, `moveBlock`, `updateBlock`, `toggleSuperset`.
- Tests: every format string from spec section 12 and the plan lines from section 6.2; shrinking Program C to 4 weeks gives a valid program; moving blocks keeps `order` contiguous.
- Commit: `feat(domain): add display formats and program editing rules`.

### Task 2: shared UI

- `PageShell` (large title, back button, toolbar buttons), `Stepper`, `labels.ts` (muscles, split types, day types, tracking types in sentence case), `useConfirm`, `BandPicker`, `ExercisePicker`, `src/pwa/files.ts`, `src/pwa/storage.ts`.
- Tests: stepper limits and steps; `saveFile` uses share when allowed and download otherwise; the first `useIonToast` and `useIonActionSheet` use is checked against the real hook.
- Commit: `feat(ui): add shared page shell, stepper, pickers and file helpers`.

### Task 3: Settings

- Effort input, sound, keep screen awake, backup reminder interval, storage status, app version. All live from `getSettings`.
- Bands page: list, add, rename, archive.
- Backup: export (then `recordBackup`), pick a file, show record counts, "Replace all data" with a confirm, "Undo last restore" when a snapshot exists. CSV export.
- Tests: changing effort mode persists; adding a band shows it; a bad file shows its error and changes nothing; restore then undo through the page.
- Commit: `feat(settings): add settings, bands and backup screens`.

### Task 4: exercise library

- List with search, muscle filter and tracking type filter. Add and edit custom exercises (built-ins allow cues and rest edits). Archive. Detail page with fields, cues and alternatives; history and charts join it in Milestone 5.
- Tests: search and both filters narrow the list; a custom exercise can be added; a duplicate name shows the error.
- Commit: `feat(library): add exercise library`.

### Task 5: programs list, new program, activation

- List with the active program on top. New program: split type, then template (built-in or blank), then name. Activation asks this Monday or next Monday.
- Tests: creating Program C from its template lists it; activating shows it first; only one is active.
- Commit: `feat(programs): add program list, template picker and activation`.

### Task 6: program editor

- Name, note, cycle length, deload weeks, weekday grid per cycle week or rotation sequence plus sessions per week. Day list. "Set current week", "Deload this week". Archive, delete with a confirm.
- Tests: changing the grid saves; shrinking the cycle drops deload weeks; a rotation can be reordered.
- Commit: `feat(programs): add program editor`.

### Task 7: day editor

- Day name, type, deload exempt, note. Blocks: add from the library, reorder, delete. Block fields by tracking type: sets range, reps, seconds, attempts, load, added kg, bands, progression level, complex parts, rest, warm-up sets, note. Supersets. Choice slots with options and `pickWhen`.
- Tests: the fields shown follow the tracking type; adding a block saves; a choice slot with two options saves.
- Commit: `feat(programs): add day editor`.

### Task 8: share and import

- Share page: the code with copy, and a JSON file through `saveFile`. Import page: paste or pick a file, preview (name, days, new exercises, new bands), then add.
- Tests: a code from one context imports in another through the page; a bad code shows its error.
- Commit: `feat(programs): add program share and import screens`.

### Task 9: verification and review

- `npm run check` and `npm run build` green, read the output.
- Run the dev server and go through every screen in the browser pane at iPhone size, light and dark.
- Grep for dashes in UI text. Check labels on icon-only buttons and 44pt touch targets.
- Code review of the branch, fix findings, report with the steps to open it on your iPhone over the LAN. Merge waits for you.
