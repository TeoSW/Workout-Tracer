import { dayTemplate, ex, reps, secs, week } from '../builders';
import type { BuiltInTemplate } from './types';

/** Templates for friends from spec section 9.4. No loads: the logger fills in last time's values. */

const FB = 'tpl-fb';
const fullBodyA = dayTemplate(FB, `${FB}-a`, 'Full Body A', 'hypertrophy', [
  ex('barbell-back-squat', 3, reps(6, 10)),
  ex('bench-press', 3, reps(6, 10)),
  ex('barbell-row', 3, reps(8, 12)),
  ex('lateral-raise', 2, reps(12, 15)),
  ex('plank', 3, secs(30, 45)),
]);
const fullBodyB = dayTemplate(FB, `${FB}-b`, 'Full Body B', 'hypertrophy', [
  ex('romanian-deadlift', 3, reps(8, 10)),
  ex('overhead-press', 3, reps(6, 10)),
  ex('lat-pulldown', 3, reps(8, 12)),
  ex('leg-press', 2, reps(10, 15)),
  ex('bicep-curl', 2, reps(10, 15)),
]);

export const FULL_BODY: BuiltInTemplate = {
  id: FB,
  name: 'Full Body',
  splitType: 'full_body',
  schedule: {
    kind: 'rotation',
    sequence: [fullBodyA.id, fullBodyB.id],
    sessionsPerWeek: 3,
    preferredWeekdays: ['mon', 'wed', 'fri'],
  },
  cycleWeeks: null,
  deloadWeeks: [],
  note: '',
  dayTemplates: [fullBodyA, fullBodyB],
};

const UL = 'tpl-ul';
const upper1 = dayTemplate(UL, `${UL}-upper-1`, 'Upper 1', 'hypertrophy', [
  ex('bench-press', 3, reps(6, 10)),
  ex('barbell-row', 3, reps(8, 12)),
  ex('overhead-press', 2, reps(8, 12)),
  ex('lat-pulldown', 2, reps(10, 12)),
  ex('triceps-pushdown', 2, reps(10, 15)),
  ex('bicep-curl', 2, reps(10, 15)),
]);
const lower1 = dayTemplate(UL, `${UL}-lower-1`, 'Lower 1', 'hypertrophy', [
  ex('barbell-back-squat', 3, reps(6, 10)),
  ex('romanian-deadlift', 3, reps(8, 10)),
  ex('leg-extension', 2, reps(10, 15)),
  ex('hamstring-curl', 2, reps(10, 15)),
  ex('calf-raise', 3, reps(10, 15)),
]);
const upper2 = dayTemplate(UL, `${UL}-upper-2`, 'Upper 2', 'hypertrophy', [
  ex('incline-db-press', 3, reps(8, 12)),
  ex('seated-cable-row', 3, reps(8, 12)),
  ex('pull-ups', 2, reps(6, 10)),
  ex('lateral-raise', 3, reps(12, 15)),
  ex('hammer-curl', 2, reps(10, 12)),
  ex('tricep-above-head', 2, reps(10, 12)),
]);
const lower2 = dayTemplate(UL, `${UL}-lower-2`, 'Lower 2', 'hypertrophy', [
  ex('deadlift', 2, reps(5)),
  ex('leg-press', 3, reps(10, 12)),
  ex('bulgarian-split-squat', 2, reps(8, 12)),
  ex('hamstring-curl', 2, reps(10, 15)),
  ex('ab-crunch', 3, reps(10, 15)),
]);

export const UPPER_LOWER: BuiltInTemplate = {
  id: UL,
  name: 'Upper/Lower',
  splitType: 'upper_lower',
  schedule: {
    kind: 'weekday',
    weeks: [week({ mon: upper1.id, tue: lower1.id, thu: upper2.id, fri: lower2.id })],
  },
  cycleWeeks: 1,
  deloadWeeks: [],
  note: '',
  dayTemplates: [upper1, lower1, upper2, lower2],
};

const PPL = 'tpl-ppl';
const push = dayTemplate(PPL, `${PPL}-push`, 'Push', 'hypertrophy', [
  ex('bench-press', 3, reps(6, 10)),
  ex('overhead-press', 2, reps(8, 12)),
  ex('incline-db-press', 2, reps(8, 12)),
  ex('lateral-raise', 3, reps(12, 15)),
  ex('triceps-pushdown', 2, reps(10, 15)),
]);
const pull = dayTemplate(PPL, `${PPL}-pull`, 'Pull', 'hypertrophy', [
  ex('pull-ups', 3, reps(6, 10)),
  ex('barbell-row', 3, reps(8, 12)),
  ex('face-pull', 2, reps(12, 15)),
  ex('bicep-curl', 2, reps(10, 15)),
  ex('hammer-curl', 2, reps(10, 12)),
]);
const legs = dayTemplate(PPL, `${PPL}-legs`, 'Legs', 'hypertrophy', [
  ex('barbell-back-squat', 3, reps(6, 10)),
  ex('romanian-deadlift', 3, reps(8, 10)),
  ex('leg-press', 2, reps(10, 15)),
  ex('hamstring-curl', 2, reps(10, 15)),
  ex('calf-raise', 3, reps(10, 15)),
]);

export const PUSH_PULL_LEGS: BuiltInTemplate = {
  id: PPL,
  name: 'Push/Pull/Legs',
  splitType: 'ppl',
  schedule: { kind: 'rotation', sequence: [push.id, pull.id, legs.id], sessionsPerWeek: 6 },
  cycleWeeks: null,
  deloadWeeks: [],
  note: '',
  dayTemplates: [push, pull, legs],
};
