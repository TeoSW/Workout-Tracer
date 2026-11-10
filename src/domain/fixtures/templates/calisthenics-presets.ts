import { dayTemplate, ex, reps, secs, week } from '../builders';
import type { BuiltInTemplate } from './types';

/**
 * Presets for friends who train with their bodyweight. No loads or bands: the logger fills in
 * last time's values after the first session. Progression rules live in the notes.
 */

const HOLD = { bandIds: [], progressionLevel: 'current' };

const BC = 'tpl-beginner-cal';
const beginnerA = dayTemplate(BC, `${BC}-a`, 'Full Body A', 'hypertrophy', [
  ex('push-ups', 3, reps(5, 12), { note: 'Raise your hands on a bench if 5 clean reps is hard.' }),
  ex('inverted-row', 3, reps(6, 12), { note: 'Lower the bar to make it harder.' }),
  ex('bulgarian-split-squat', 2, reps(8, 12), { note: 'Per leg, bodyweight to start.' }),
  ex('pike-push-ups', 2, reps(5, 10)),
  ex('hollow-body-hold', 3, secs(20, 30)),
]);
const beginnerB = dayTemplate(BC, `${BC}-b`, 'Full Body B', 'hypertrophy', [
  ex('dips', 3, reps(5, 10), { note: 'Use a band if 5 clean reps is hard.' }),
  ex('pull-ups', 3, reps(3, 8), { note: 'Use a band if 3 clean reps is hard.' }),
  ex('squat', 3, reps(10, 15), { note: 'Bodyweight until 3 x 15 is easy.' }),
  ex('planche-lean', 3, secs(15, 20)),
  ex('plank', 2, secs(30, 45)),
]);

export const BEGINNER_CALISTHENICS: BuiltInTemplate = {
  id: BC,
  name: 'Beginner calisthenics',
  splitType: 'full_body',
  schedule: {
    kind: 'rotation',
    sequence: [beginnerA.id, beginnerB.id],
    sessionsPerWeek: 3,
    preferredWeekdays: ['mon', 'wed', 'fri'],
  },
  cycleWeeks: null,
  deloadWeeks: [],
  note: 'Three full body days a week with a rest day between them. When every set reaches the top of the range, make the exercise harder.',
  dayTemplates: [beginnerA, beginnerB],
};

const SS = 'tpl-skill-strength';
const skillPush = dayTemplate(
  SS,
  `${SS}-push`,
  'Planche and push',
  'skill_heavy',
  [
    ex('warm-up', 1, {}, { note: '10 min: wrists, scap push-ups, easy holds.' }),
    ex('planche-hold', 4, { ...secs(5, 10), ...HOLD }, { restSec: 120 }),
    ex('planche-lean', 3, secs(15, 20), { restSec: 60 }),
    ex('weighted-dips', 3, reps(5, 8), { note: 'Add 2.5kg when every set reaches 8 at 1-2 RIR.' }),
    ex('push-ups', 2, reps(8, 15)),
    ex('lateral-raise', 2, reps(12, 15)),
  ],
  { note: 'Skill first, while fresh.' },
);
const skillPull = dayTemplate(
  SS,
  `${SS}-pull`,
  'Front lever and pull',
  'skill_heavy',
  [
    ex('warm-up', 1, {}, { note: '10 min: shoulders, scap pull-ups, easy holds.' }),
    ex('front-lever-hold', 4, { ...secs(5, 10), ...HOLD }, { restSec: 120 }),
    ex('front-lever-raises', 3, { ...reps(5), ...HOLD }, { restSec: 120 }),
    ex('weighted-pull-ups', 3, reps(5, 8), {
      note: 'Add 2.5kg when every set reaches 8 at 1-2 RIR.',
    }),
    ex('inverted-row', 2, reps(8, 12)),
    ex('bicep-curl', 2, reps(10, 12)),
  ],
  { note: 'Skill first, while fresh.' },
);
const legsCore = dayTemplate(SS, `${SS}-legs`, 'Legs and core', 'hypertrophy', [
  ex('squat', 3, reps(6, 10)),
  ex('romanian-deadlift', 3, reps(8, 10)),
  ex('hamstring-curl', 2, reps(10, 12)),
  ex('calf-raise', 3, reps(10, 15)),
  ex('hollow-body-hold', 3, secs(30)),
]);
const strengthWeek = week({ mon: skillPush.id, wed: skillPull.id, fri: legsCore.id });

export const SKILL_STRENGTH_4_WEEK: BuiltInTemplate = {
  id: SS,
  name: 'Skill and strength 4-week cycle',
  splitType: 'calisthenics_cycle',
  schedule: { kind: 'weekday', weeks: [strengthWeek, strengthWeek, strengthWeek, strengthWeek] },
  cycleWeeks: 4,
  deloadWeeks: [4],
  note: 'Three weeks of building, then a deload week with half the sets. Move up a hold progression after 4 x 10s clean.',
  dayTemplates: [skillPush, skillPull, legsCore],
};

const M2 = 'tpl-minimal-2';
const minimalA = dayTemplate(M2, `${M2}-a`, 'Day A', 'hypertrophy', [
  ex('squat', 3, reps(6, 10)),
  ex('push-ups', 3, reps(8, 15)),
  ex('pull-ups', 3, reps(5, 10)),
  ex('plank', 2, secs(30, 45)),
]);
const minimalB = dayTemplate(M2, `${M2}-b`, 'Day B', 'hypertrophy', [
  ex('romanian-deadlift', 3, reps(8, 10)),
  ex('dips', 3, reps(6, 10)),
  ex('inverted-row', 3, reps(8, 12)),
  ex('calf-raise', 2, reps(10, 15)),
]);

export const MINIMAL_2_DAYS: BuiltInTemplate = {
  id: M2,
  name: 'Minimal 2 days',
  splitType: 'full_body',
  schedule: {
    kind: 'rotation',
    sequence: [minimalA.id, minimalB.id],
    sessionsPerWeek: 2,
    preferredWeekdays: ['tue', 'fri'],
  },
  cycleWeeks: null,
  deloadWeeks: [],
  note: 'Two full body days for busy weeks. Each covers legs, a push and a pull.',
  dayTemplates: [minimalA, minimalB],
};
