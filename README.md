# Workout Tracker

A free workout logger for iPhone. It logs sets, reps, load, bands, holds, skill attempts and RIR or RPE against a program, then turns the logs into stats. It never suggests progression.

Everything stays on your phone. There are no accounts, no server and no shared data.

## Install on an iPhone

You need iOS 17 or later.

1. Open https://teosw.github.io/workout-tracker/ in Safari.
2. Tap Share, then Add to Home Screen.
3. Open the app from the home screen, and use it from there.

Data saved in a Safari tab stays in that tab and won't appear in the installed app. The first launch of the installed app needs a connection, and after that it works offline.

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
