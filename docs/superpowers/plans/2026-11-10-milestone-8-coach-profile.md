# Milestone 8: coach profile

Status: draft, waiting for approval.

## What you asked for

A switch in Settings to a coach profile. Your own profile keeps all its data. In the coach profile you add clients, build a workout program for each one, and send it to the client's phone, for example over WhatsApp.

This reverses a decision in spec section 14 ("no accounts, server or social features") only in part: there are still no accounts and no server. Everything stays on the coach's phone until the coach sends a program.

## How it works

1. **Settings, Profile:** a switch between "My training" and "Coach". Switching reloads the app into the other profile. The tab bar and Settings always show which profile is open.
2. **Separate data:** the coach profile lives in its own database on the phone. Your own programs, workouts, missed days and stats are never touched, and switching back shows them exactly as they were.
3. **Coach tabs:** Clients, Exercises and Settings. No Today, History or Progress, because the coach doesn't log their own training there.
4. **Clients:** add a client with a name and an optional note (goals, injuries, equipment). Each client has a list of programs.
5. **Building a program:** the same screens as now: start from a preset (your 5-week cycle included) or blank, then edit days, exercises, sets, loads, bands, rests and notes.
6. **Send to client:** opens the share sheet with:
   - a short message plus the program code, ready to paste in WhatsApp: "Here is your program 'Calisthenics 5-week cycle'. In Workout Tracker, go to Programs, Import program, and paste this code: WT1...", or
   - the program as a .json file, for clients who prefer a file.
7. **On the client's phone:** Programs, Import program, then paste the code or pick the file. This already works today, so the client only needs the app installed.
8. **Record:** each program shows when it was last sent ("Sent 10 Nov 2026"). If you edit it later, it says "Changed since sent", so you know to send it again.

## Data

- The coach database has the same tables as now, plus `clients` (`id`, `name`, `note`, `createdAt`, `archived`) and a `clientId` and `sentAt` on each program.
- Your own profile's database and backup format don't change.
- **Coach backup:** Settings in the coach profile exports and restores the coach data as its own file ("workout-tracker-coach-backup-2026-11-10.json"). A coach backup can't be restored into your own profile, or the other way round, and the app says so. This is a new backup kind, so approving this plan approves it.

## Not in this milestone

- Clients sending their logs back to the coach. That would be the "files from clients" option: the client exports their log, and the coach imports it into the client's page to see what they did. It fits on top of this milestone later.
- Live sync, accounts, or a server.
- Logging a client's session on the coach's phone. If you want that (for in-person sessions), say so and I'll add Today and a logger to the coach profile.

## Tasks

1. Profile setting and a second database, with the data context switching on reload (TDD).
2. Clients: list, add, edit, archive, and the client page with its programs.
3. Program creation and editing inside a client, reusing the preset and editor screens.
4. Send to client: message with code, or file; the sent date and "Changed since sent".
5. Coach backup and restore, refusing the wrong kind of file.
6. Tabs and Settings for the coach profile, with the profile shown.
7. End-to-end test: switch to Coach, add a client, build a program from the 5-week preset, send it, import it in a second phone's context, switch back and find your own data unchanged.
8. Browser check at iPhone size, code review, README, version 1.2.0, report.
