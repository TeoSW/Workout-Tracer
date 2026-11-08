# Milestone 6 plan: PWA and deploy

Spec: `docs/superpowers/specs/2026-10-30-workout-tracker-design.md` (sections 2, 6.8, 6.9, 8, 10, 11, 13).
Builds on Milestones 1 to 5.

Goal: the app installs from GitHub Pages, works offline, updates without interrupting a workout, and never traps anyone's logs.

Done when: `npm run check` is green, all end-to-end tests pass on iPhone WebKit including flows 4 and 5, GitHub Actions deploys to Pages, and the manual iPhone check passes.

Branch: `milestone-6-pwa-deploy`. One commit per task.

## What I need from you

1. A yes to one network call. Section 0 says to ask before adding one. When the app comes back to the foreground, it asks its own GitHub Pages site whether `sw.js` changed, at most once an hour. It sends no data. An installed iPhone app can stay in memory for days, and without this call it would only notice an update on a cold start. If you say no, delete that one step from Task 2.
2. The repo. I assume the name `workout-tracker`, which gives `https://teosw.github.io/workout-tracker/`. A different name means changing `BASE_PATH` and the Playwright base URL. `gh` is not installed here, so you create the empty repo on github.com and I push to it after you say so.
3. Agreement that the repo is public. GitHub's docs tie Pages on a private repo to your plan, and I did not confirm that a free plan allows it. Public is the simple route. Everything in the repo becomes readable, including the spec in `docs/` with your own programs. Commits use your GitHub noreply address, so your email stays out of them.

## What the docs and a spike confirmed

Read the docs for vite-plugin-pwa and its assets generator, the source of the plugin's options and the generator's device list, the Workbox build options, Vite's Pages guide, the GitHub Pages docs, the WebKit storage post, MDN, and Playwright's service worker and offline pages. Ran a throwaway copy of this repo on Node 20.12.1 with npm 10.9.3. Nothing from the spike is in the repo.

- vite-plugin-pwa 2.0.0 and @vite-pwa/assets-generator 2.0.0 need Node 20.19. Their previous releases, 1.3.0 and 1.0.4, declare Node 16, and 1.3.0 accepts Vite 6. Both installed here, so I pin those. Your Node stays as it is.
- npm brings in `workbox-build`, `workbox-window` and `sharp` by itself. The plugin's docs suggest adding `workbox-window` as a dev dependency, but the build and all tests passed without it, so nothing outside section 10 goes in `package.json`. `workbox-build` pulls a deprecated `glob` 11, a build-time warning that never reaches the phone.
- The generator ran on Windows in 10 seconds and wrote 51 files, 457 kB in all, from a test SVG with 11 iPhone sizes in light and dark.
- A build with the plugin precached 21 files, 2.3 MB, with `start_url` and `scope` both at `/workout-tracker/`.
- The main chunk is 1.84 MB and Workbox's default per-file limit is 2 MiB, which is close. I did not confirm what happens past the limit, so Task 2 sets 4 MiB and a test checks that the main chunk is in the precache list.
- The 9 existing end-to-end tests all pass with the service worker on.
- Playwright says service workers only work on Chromium, but its WebKit here registered one, activated it and took control after a reload. With `setOffline`, a reload still showed the app and the Progress tab's lazy chunk loaded. With service workers blocked, the same reload failed and showed nothing. So an offline test on WebKit proves something on this machine. It may not hold on other Playwright versions, and Task 6 says what happens then.
- In that WebKit, `navigator.share` is missing, so Export backup falls back to a download. The download and picking the file again both worked, which covers flow 4's path. The real share sheet is only tested on your iPhone.
- WebKit grants `persist()` "based on heuristics like whether the website is opened as a Home Screen Web App". That post is from 2023 and gives no exact rule. The app can ask but can't force it.
- Each action tag in the Vite Pages workflow matches its pinned commit: checkout v7, setup-node v7, configure-pages v6, upload-pages-artifact v5, deploy-pages v5. I keep the full commit pins.
- Pages must have its source set to GitHub Actions under Settings, once, by you.
- Not confirmed: Apple's docs on status bar tags are from 2014, and its `navigator.standalone` page is gone. MDN has no Safari detail on `theme-color`. These get checked on your phone.

## Dependencies

`vite-plugin-pwa` 1.3.0 and `@vite-pwa/assets-generator` 1.0.4, both dev dependencies and both named in section 10. Install with `npx -y npm@10.9.3 install`.

## Data model

No changes: no schema bump, and the backup format stays as it is.

## Decisions for this milestone

1. Icons and splash screens are generated once and committed to `public/`, so builds don't need `sharp`. `npm run generate-assets` remakes them. The logo is a plain original barbell mark. I'll show it to you before the deploy.
2. Splash screens cover the 11 iPhone sizes of the supported models, in light and dark. The generator also makes landscape files. I keep them as generated rather than add a script to remove them.
3. Splash images stay out of the precache because iOS only needs them at launch and they would add a download for nothing. The precache takes JS, CSS, HTML and the manifest icons.
4. `APP_NAME` in `src/domain/config.ts` stays the one place for the name. `vite.config.ts` reads it for the manifest, and a small inline plugin puts it in the `index.html` title.
5. The manifest holds one theme color, so light and dark come from two `theme-color` meta tags with media queries, using the app's grouped backgrounds (#f2f2f7 and #000000). The status bar stays on `default`, and your iPhone check confirms it looks right.
6. `id` in the manifest is set to the base path, so a later change to `start_url` doesn't turn the app into a new install.
7. The update toast says "Update available", with Update and Later. It never shows while a workout is active and appears once the workout ends. Later hides it until the next launch.
8. The error boundary sits outside `DataProvider` and everything Ionic. Its screen is plain HTML, so it works when the crash is in the shell. It has "Export my data" and "Reload". A lazy chunk that fails to load lands here as well, and Reload fixes that. `DataProvider`'s failed state shows the same screen, so a database that won't open still gets an export attempt. If that fails too, the screen says so.
9. The install banner sits at the top of Today in a Safari tab, and it can't be dismissed, because the warning stays true for as long as someone logs in a tab. Remembering a dismissal would need a new setting.
10. `persist()` runs on every launch in standalone mode until it is granted, not just the first. iOS shows no prompt, so repeating it costs nothing, and one refusal isn't final. This is a small step past the spec's "on first launch". Settings reads the status each time the page opens.
11. The backup reminder sits on Today, under the install banner, and has an Export backup button. It stays hidden during an active workout. With no backup yet, the interval counts from the first finished session, so a new user isn't nagged before there is anything to lose. It counts whole calendar days, so a clock change can't shift it.
12. CI uses Node 22, fixed, rather than `lts/*`, so a new LTS can't break a deploy on its own. It runs `npm run check` and `npm run build`, which covers install, lint, typecheck, unit tests and build from section 10.4, plus the format check. End-to-end tests stay local, since section 10.4 doesn't list them.
13. The iPhone check comes after the merge this time, because Pages only deploys from `main`. The milestone stays open until the check passes, and fixes go in on small follow-up branches.

## Order of tasks

### Task 1: manifest, icons and splash screens

- Add both packages. Confirm `package-lock.json` lists `@rollup/rollup-linux-x64-gnu`, `@esbuild/linux-x64` and `@img/sharp-linux-x64`, since a lockfile written on Windows has to work on CI and on Arch.
- `public/logo.svg`, `pwa-assets.config.ts` with `combinePresetAndAppleSplashScreens(minimal2023Preset, ...)`, and a `generate-assets` script. Commit the output.
- `VitePWA` in `vite.config.ts` with `registerType: 'prompt'`, `injectRegister: false` and the manifest: name, short name, `display: standalone`, `orientation: portrait`, `id`, theme and background colors, 192 and 512 icons, the maskable icon.
- `index.html`: the generator's links, theme color tags, `apple-mobile-web-app-capable`, status bar and title tags.
- Tests: `tests/e2e/pwa.spec.ts` fetches the manifest and checks `start_url`, `scope`, `id`, and that every icon and every `<link>` file in `index.html` loads.
- Commit: `feat(pwa): add manifest, icons and splash screens`.

### Task 2: service worker and update toast

- `workbox.globPatterns` for JS, CSS and HTML, `maximumFileSizeToCacheInBytes` at 4 MiB. Add `vite-plugin-pwa/react` to `tsconfig.json` types.
- `src/pwa/useAppUpdate.ts` wraps `useRegisterSW` from `virtual:pwa-register/react`. It returns whether an update waits, an apply function and a dismiss function. `onRegisteredSW` keeps the registration.
- On `visibilitychange` to visible, when online and at least an hour since the last check, call `registration.update()` and ignore a failure. This is the network call from "What I need from you".
- `src/app/UpdateToast.tsx` inside `DataProvider`, with `IonToast` at the top so it clears the rest bar and tab bar. It is open when an update waits and no session is active.
- Vitest gets an alias from the virtual module to a stub under `tests/ui`, so the toast can be tested.
- Tests: toast shows, hides during an active session, returns when the session finishes, Update applies, Later hides. Unit test of the hourly check. In `pwa.spec.ts`, `sw.js` lists the main chunk.
- Commit: `feat(pwa): add service worker and update toast`.

### Task 3: error boundary

- `src/features/settings/saveBackup.ts` holds the export, save and record steps, used by `BackupSection` and this screen.
- `src/app/ErrorBoundary.tsx` and `CrashScreen.tsx`. It takes `ctx` as a prop, wraps `DataProvider` in `App`, and logs the error to the console.
- `DataProvider`'s failed state renders `CrashScreen`.
- Copy: "Something went wrong", "Your logs are still on this device. Export them, then reload."
- Tests: a throwing child shows the screen, export writes a file that `parseBackup` accepts, a failed export shows a message, Reload reloads, a rejected `lazy` import reaches the screen.
- Commit: `feat(app): add an error boundary with data export`.

### Task 4: install banner and persistent storage

- `src/pwa/install.ts`: `isStandalone()` checks `display-mode: standalone` and `navigator.standalone`.
- `requestPersistentStorage()` in `src/pwa/storage.ts` is feature-detected, runs only in standalone mode and only when not already persisted. `App` calls it once at launch.
- `src/features/today/InstallBanner.tsx`. Copy: "Install this app: tap Share, then Add to Home Screen. Data saved in this Safari tab won't appear in the installed app."
- Settings rereads storage status on `useIonViewWillEnter`.
- Tests: banner in a tab, no banner in either standalone case, `persist()` skipped in a tab, skipped when already persisted, skipped when the API is missing, Settings showing the new status. One end-to-end check with `navigator.standalone` set before load.
- Commit: `feat(pwa): add install banner and persistent storage request`.

### Task 5: backup reminder

- Domain, test first: `backupDue` in `src/domain/backup.ts` takes the last backup, the reminder days, the first finished session and today, as plain values. Cases: never backed up with no sessions, never backed up inside and past the interval, the exact day it falls due, across the March and October clock changes, a backup dated later than today.
- Data, test first: `firstFinishedAt(ctx)` in `src/data/history.ts`.
- `src/features/today/BackupReminder.tsx` with the text and an Export backup button through `saveBackup`. It disappears after a save and stays after a closed share sheet.
- Tests: shows when due, hides during a workout, leaves after export, stays after cancel, follows a changed interval.
- Commit: `feat(today): add backup reminder`.

### Task 6: flows 4 and 5, and offline

- Flow 4: log a workout, export and catch the download, delete the database, reload, restore the file, export again, and compare both files table by table. `exportedAt` and `lastBackupAt` are left out of the comparison. Also see the session in History.
- Flow 5: create Program A from its template, read the share code, open a fresh browser context, import the code, and check that every day is there.
- Offline test in `pwa.spec.ts`: wait for the service worker, reload once so it takes control, go offline, reload, then open Progress and start a workout. If WebKit stops supporting this, the test goes, and the precache check plus your airplane mode check cover it. I'll tell you if that happens.
- One-off check, not committed: build, open the app, rebuild with a changed version, reopen, see the toast, tap Update, read the new version in Settings.
- Commit: `test: add flows 4 and 5 and an offline check`.

### Task 7: deploy workflow and README

- `.github/workflows/deploy.yml` from Vite's Pages guide, with the five pinned actions, Node 22, `npm ci`, `npm run check` and `npm run build`. It runs on pushes to `main` and by hand.
- `README.md`: what the app is, how to install it on an iPhone, the tab warning, how to back up, and the npm scripts.
- Set `version` to 1.0.0, which Settings shows.
- Commit: `ci: deploy to GitHub Pages` and `docs: add README`.

### Task 8: main chunk size

- Measure what fills the 449 kB gzipped main chunk, with a one-off script that reads the build's chunk report, adding no dependency. This gets one pass.
- If one cheap cause accounts for 100 kB gzipped or more, fix it. Otherwise leave it and report the numbers. The app loads from the phone after the first visit, so parse time matters more than download size, and your iPhone gives the real number.
- Commit only if something changes: `perf: trim the main chunk`.

### Task 9: verification and review

- Go through the banners, toast, crash screen and offline state in the browser pane at iPhone size, light and dark, at a larger text size too.
- `npm run check`, `npm run build` and `npm run test:e2e` green, read the output.
- Grep new UI text and docs for dashes.
- Code review of the branch, fix findings, report. Merge waits for you.

### Task 10: publish, after you say so

- You create the empty repo and set Pages to GitHub Actions.
- I add the remote and push `main`, then read the workflow run and open the live URL. The first run is also the first real test of the workflow, since nothing can run it here.
- If you chose a different repo name, `BASE_PATH` changes first.

### Task 11: iPhone check, by you

From the spec:

- Install from the Pages URL. Open it once online, close it, then use it in airplane mode.
- The screen stays on during a workout.
- Sound plays at the end of rest.
- Settings shows storage as persistent.
- Backup goes to Files through the share sheet.
- Restore from Files works.

Added from earlier milestones and this one:

- The install banner shows in Safari and not in the installed app.
- Icon, splash screen and status bar look right in light and dark.
- Scrolling works when your finger starts on a chart.
- A tap on a chart reads a value.
- The app feels fast enough on a cold start.
- After I push a small change, the toast appears, stays away during a workout, and Update loads the new version.

If storage shows as not persistent after install, that is iOS's decision. I'd report it and rely on the backup reminder, since the app has no way to force it. Your backup is the protection either way.

Then a short final report. Phase 2 stays unplanned until you ask.
