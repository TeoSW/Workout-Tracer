# Workout Tracker

A free workout logger for iPhone. It logs sets, reps, load, bands, holds, skill attempts and RIR or RPE against a program, then turns the logs into stats. It never suggests progression.

Everything stays on your phone. There are no accounts, no server and no shared data.

## Install

On an iPhone you need iOS 17 or later.

1. Open https://teosw.github.io/Workout-Tracer/ in Safari.
2. Tap Share, then Add to Home Screen.
3. Open the app from the home screen, and use it from there.

On Android, open the site in Chrome, open the browser menu, then tap Install app or Add to Home screen. The app is tested on iPhone, not on Android.

Data saved in a browser tab stays in that tab and won't appear in the installed app. The first launch of the installed app needs a connection, and after that it works offline.

## Programs and missed days

New program opens on a list of presets, including the Calisthenics 5-week cycle. Pick one, check its weeks and days, set the week you are in, and tap Use this program.

On a training day, Today asks "Training today?". Tap Not today to skip the day, with an optional reason. The plan stays as it is, History keeps a record of the missed day, and Progress counts missed days each month.

## Training

On Today, tap Start workout. You see the day from your program and its exercises, and you can pick another week or day first. While a workout runs, Today shows its exercises with Continue workout and End workout. Tap the check on a set to log it and start the rest. Tap the rest time to set your own.

## Coach profile

In Settings, switch Profile to Coach. Your own training stays as it is in My training. As a coach you add clients, build a program for each one from a preset or from scratch, and tap Send to send it as a WhatsApp message or a file. The client pastes the code under Programs, Import program. The coach profile has its own backup file.

## Keep a backup

iOS can clear app data, and removing the app deletes it. In Settings, tap Export backup and save the file to Files. The app reminds you when your last backup is older than the interval you set. Restore from file brings it all back, on this phone or a new one.

If the app ever crashes, the screen it shows has an Export my data button.

## Updates

When a new version is ready the app shows "Update available". It waits until no workout is running, so an update never interrupts one.

## Development

You need Node 20.12 or later. On npm 10.5, which has an install bug, use `npx -y npm@10.9.3 install`.

| Command                   | What it does                                      |
| ------------------------- | ------------------------------------------------- |
| `npm run dev`             | Starts the dev server                             |
| `npm run check`           | Runs typecheck, lint, format check and unit tests |
| `npm run test:e2e`        | Runs the Playwright tests on iPhone WebKit        |
| `npm run build`           | Builds the site into `dist`                       |
| `npm run preview`         | Serves the build, with the service worker         |
| `npm run generate-assets` | Remakes icons and splash screens from the logo    |

Run `npx playwright install webkit` once before the end-to-end tests. The service worker only runs in a build, not on the dev server.

Every push to `main` runs the checks and deploys to GitHub Pages. The repo path is `BASE_PATH` in `vite.config.ts`, and the Playwright base URL has to match it.

The design is in `docs/superpowers/specs`, and each milestone's plan is in `docs/superpowers/plans`.
