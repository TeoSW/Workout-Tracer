# Milestone 7: simpler screens, missed days, presets

Status: draft, waiting for approval.

## What you asked for, and where it stands

| Request | Today | This milestone |
|---|---|---|
| Simpler design | Native iOS look, but some flows take extra taps and presets are hidden | Simplify Today, the logger and New program (section 1) |
| Say when I missed a day | Missed days only show up as gaps in the consistency stats | "Not today" button, a reason, evidence in History (section 2) |
| Skip a missed day | Weekday programs already keep the calendar; rotations wait for you | A missed day is skipped in both kinds of program (section 2) |
| Cycle presets, yours from the Excel | Six templates exist, but only behind the Split picker | A Presets list, the Excel cycle, three new presets (section 3) |
| Ask before each workout if I'll do it | Nothing | A check-in on Today when you open the app (section 4) |
| Workout timer | Already there: the logger header shows elapsed time, and the summary shows duration | Add the duration to History rows |
| Rest times with alarms | Already there: the rest timer starts on Done, beeps and flashes at zero | Bigger timer bar; a lock screen alarm needs Phase 2 (section 4) |
| Button for "set done" that starts rest | Already there, but it takes two taps (open the set, tap Done) | One tap on a check button per set (section 1) |

## 1. Simpler screens

The iOS look stays, because it's a decision in spec section 14. The changes cut steps and clutter, following the UI/UX skill's rules: one main action per screen, 44pt touch targets, details only when asked for.

- **Today:** one card at the top with the day name, "Week 3 of 5", a Deload badge when it applies, a big Start button, and a "Not today" button. Bodyweight becomes one row that opens a sheet. The install banner and backup reminder become single compact rows.
- **Logger:** every set row gets a round check button on the right. One tap logs the set with the prefilled values (last time, else the plan) and starts the rest timer. Tapping the row still opens the sheet for editing. The rest bar gets bigger, with the time in large digits plus +15s and Skip.
- **New program:** opens on a Presets list (section 3) instead of the Split, Template and Name form. "Blank program" sits at the bottom.

## 2. Missed days

- On a planned training day, Today offers "Not today". It opens a short sheet: an optional reason (Sick, Busy, Pain, Travel, Other) and a note. Saving records the missed day and shows the next planned day.
- **Weekday programs:** the calendar doesn't move, so the missed day is just skipped.
- **Rotation programs:** the rotation moves past the missed day, so the next session is the one after it.
- Days you never mark still count as missed in the stats, as now.
- **Evidence:** History's calendar marks missed days in their own color, and tapping one shows the date, the planned day and the reason. Progress shows missed days per month next to the consistency stat.
- You can undo a missed day from History if you marked it by mistake.

**Data model:** this adds one table, `missedDays` (`id`, `programId`, `date`, `dayTemplateId`, `rotationIndex`, `reason`, `note`). Backups move to schema version 2. Version 1 backups still restore, with an empty missed-days list. You asked to approve any change to the backup format, so approving this plan approves this one.

## 3. Presets

The Programs tab and New program show one list of presets. Each opens a preview (days, exercises, weekly calendar), then "Use this program" creates it and makes it active, asking which week you're in.

- **Calisthenics 5-week cycle (from your Excel).** Weekday grid with a 5-week cycle:
  - Weeks 1-2: Tuesday Heavy 1 (intensity), Thursday Light, Saturday Heavy 2 (intensity), Sunday Legs.
  - Weeks 3-4: the same days with the volume versions of Heavy 1 and Heavy 2.
  - Week 5: deload. The app's deload rule halves the volume days' sets, rounded up, which matches your Deload sheets. Saturday is the Test day, and Legs stays as normal.
  - Rest times, bands, loads, RPE notes, the planche-first and breathing rules, and the cycle rules come from the sheet as block and program notes. "Bicep Curl 1+1" becomes one Preacher Curl set and one Dumbbell Curl set.
  - The test's weak-point accessory (Planche Lean, Front Lever Raises or Hollow Body Hold) becomes a choice slot, so the test flow picks next cycle's accessory.
  - The yellow test log cells map to the app's test results.
- **Already in the app, now visible:** ULU/LUL, PPLL, Calisthenics 6-week cycle, Full Body, Upper/Lower, Push/Pull/Legs.
- **New, made by me (no loads, so the logger learns from your first session):**
  - Beginner calisthenics: 3 days a week, full body, push-ups, rows, squats, dips progression, hollow hold.
  - Skill and strength 4-week cycle: 3 weeks building, 1 week deload, planche and front lever work first, then weighted pull-ups and dips.
  - Minimal 2 days: two full body days for busy weeks.

## 4. Check-in and alarms

The iPhone limits what a web app can do here. With no server, it can't send a notification at a set time, and its timers stop when the phone locks (spec section 2).

- **In this milestone:** when you open the app on a planned day before starting, Today asks "Training today?" with Start and Not today. It's the same choice as a notification, but you only see it when you open the app.
- **Real notifications** (a morning "Heavy 1 today, will you train?" and a lock screen "Rest over") need a small push server. Spec section 15 already plans one for the rest alarm as Phase 2, on Cloudflare's free plan. The morning reminder could go on the same server. The phone would send only the push address, your training weekdays and a reminder time, never your workouts. I'd plan that as Milestone 8, after this one, and it needs your approval for the network calls.

## 5. Not changing

- No progression suggestions. The Excel's rules ("add 2.5kg when...") stay as notes, as spec section 14 says.
- No accounts and no sync.

## Tasks

1. `missedDays` table, backup schema v2 with migration from v1, and domain rules for skipping in weekday and rotation programs (TDD).
2. Today: the new top card, "Not today" sheet, check-in wording, compact rows.
3. History and Progress: missed-day marks, detail and undo, monthly count, session duration in rows.
4. Logger: one-tap check button per set, bigger rest bar.
5. Presets: the Excel cycle as a built-in template, three new templates, the Presets list and preview, and "Use this program".
6. End-to-end tests: mark a day missed and see the next day; start the Excel preset and log Heavy 1 in week 1 and week 5 (deload sets); one-tap set logging starts the rest timer.
7. Verify in the browser at iPhone size in light and dark, code review, README update, then the report.
