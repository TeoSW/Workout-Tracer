# Milestone 9: logger, alarms, stats and time

Status: draft, waiting for approval.

## Your list, and what each one becomes

| You asked                                     | Now                                                                                              | This milestone                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Duplicate set button on every set             | Add set copies nothing                                                                           | A copy button on each logged set: adds the same set again, logged, and starts the rest               |
| Edit notes for every exercise, e.g. RPE       | Exercise notes hide in the ... menu; sets have no note                                           | A Note button on every card, and a Note field plus RPE/RIR in the set sheet                          |
| Some exercises have no RIR/RPE                | The set sheet shows effort only for rep exercises                                                | Effort chips for holds, complexes and skill attempts too (a bug from 1.4.0)                          |
| Custom alarm                                  | One fixed sound                                                                                  | Settings, Alarm: pick the sound (Beeps, Bell, Chime, Rising), how many times it repeats, and test it |
| Alarm or notification when out of the app     | Not possible: iOS stops web apps in the background                                               | Needs a small push server (section 2)                                                                |
| Reminders for when to work out                | None                                                                                             | Calendar reminders now (section 2), push reminders with the server                                   |
| Save workout button for custom workouts       | An empty workout can't be reused                                                                 | "Save as program" on the summary and in the logger menu                                              |
| Buttons sometimes don't work                  | See section 3                                                                                    | Fix the cause I found, and ask you which buttons                                                     |
| Statistics for volume, bands, kg              | Per exercise: e1RM, heaviest, band level, best reps; overview: consistency, sets per muscle, PRs | Volume and band statistics with graphs (section 4)                                                   |
| Tracker for total minutes and working minutes | Only total duration                                                                              | Total, working and rest minutes per workout and per week (section 5)                                 |

## 1. Logger

- **Duplicate:** a copy icon on each logged set. One tap adds a new set with the same reps, load, band, time and effort, marked done, and starts the rest.
- **Notes:** each card gets a visible Note button (no more hunting in the ... menu). The set sheet gets a Note field, and the note shows under the set.
- **Effort everywhere:** RIR/RPE chips in the set sheet for every type except the warm-up checklist.
- **Save as program:** after an empty workout, "Save as program" makes a program (or adds a day to an existing one) with the same exercises, sets, reps, loads and bands as the plan.

## 2. Alarms and reminders outside the app

iOS freezes a web app when it is in the background or the phone locks. The app can't make a sound or a notification by itself then. Two ways round it:

- **Calendar reminders (no server, in this milestone):** "Add reminders to Calendar" in Settings makes a calendar file of your training days for the next weeks, each with an alert at the time you choose. iOS Calendar then reminds you, even with the app closed.
- **Push notifications (needs your approval):** the plan from spec section 15. A free Cloudflare Worker sends "Rest over" to the lock screen when a rest ends, and a morning "Heavy 1 today" reminder. The phone sends only its push address, the time the rest ends, and your training days. No workout data leaves the phone. It needs:
  - your OK for these network calls (you asked to approve any),
  - a free Cloudflare account, which you create; I write the worker and a step-by-step deploy.

  I'd build it as Milestone 10, right after this one.

## 3. Buttons that don't respond

One cause I found: when a rest is running, the rest bar sits over the bottom of every page, so the last button on a page (often Add set, or Add exercise) is under the bar and the tap lands on the bar. Fix: pages get room at the bottom while the bar shows. If other buttons misbehave, tell me which ones and on which screen.

## 4. Statistics

- **Overview (Progress):** volume per week (kg x reps, including added kg), sets and reps per week, and this week against last week and the 4-week average, as numbers and a chart.
- **Per exercise:** a volume chart per workout, total reps, best set, average effort, and the change since 4 weeks ago.
- **Bands:** for banded exercises, how many sets you did with each band per week, and when you last moved to a thinner band.

## 5. Time tracker

- Each workout records the time spent resting (from the rest timer).
- Summary and History show total minutes, working minutes (total minus rest) and rest minutes.
- Progress shows weekly totals and the average per workout.

## Data

Optional new fields only: a note on each logged set (already allowed), the rest time on each workout, and the alarm settings. Backups stay version 3 and older backups still restore.

## Tasks

1. Effort chips for every type, and the rest-bar padding fix (TDD).
2. Duplicate set, set notes, card Note button.
3. Alarm sounds, repeats and test in Settings.
4. Calendar reminders file.
5. Save as program from a workout.
6. Rest time recording; total, working and rest minutes in Summary, History and Progress.
7. Volume, reps and band statistics with charts.
8. End-to-end tests, browser check at iPhone size, review, version 1.5.0.
