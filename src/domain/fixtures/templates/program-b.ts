import { bands, dayTemplate, ex, kg, reps, week } from '../builders';
import type { BuiltInTemplate } from './types';

const P = 'tpl-b';
const r = reps(8, 12);

const push = dayTemplate(P, `${P}-push`, 'Push', 'hypertrophy', [
  ex('upper-chest', 2, { ...r, ...kg(4) }),
  ex('military-press', 2, { ...r, ...kg(2) }),
  ex('push-ups-incline', 2, r),
  ex('tricep-above-head', 2, { ...r, ...kg(5) }),
  ex('tricep-below-head', 2, { ...r, ...kg(10) }),
]);

const pull = dayTemplate(P, `${P}-pull`, 'Pull', 'hypertrophy', [
  ex('pull-ups', 2, { ...r, ...bands('band-35', 'band-15') }),
  ex('mid-back-row', 2, { ...r, ...kg(25) }),
  ex('kelso-shrug', 2, { ...r, ...kg(7.5) }),
  ex('lateral-raise', 2, { ...r, ...kg(2) }, { note: 'On Pull day so the side delts are fresh.' }),
  ex('bicep-curl', 2, { ...r, ...kg(3) }),
]);

const legs = dayTemplate(P, `${P}-legs`, 'Legs', 'hypertrophy', [
  ex('squat', 2, { ...r, ...kg(10, 15) }),
  ex('bulgarian-split-squat', 2, { ...r, ...kg(10, 15) }),
  ex('hip-thrust', 2, { ...r, ...kg(15, 25) }),
  ex('lumbar-extension', 2, { ...r, ...kg(10) }),
  ex('leg-extension', 2, { ...r, ...kg(5, 7.5) }),
  ex('hamstring-curl', 2, { ...r, ...kg(5) }),
  ex('adductors', 2, { ...r, ...kg(25, 40) }),
  ex('abductors', 2, { ...r, ...kg(25, 40) }),
  ex('calf-raise', 2, { ...r, ...kg(20) }),
  ex('ab-crunch', 2, { ...r, ...kg(15) }),
]);

export const PROGRAM_B: BuiltInTemplate = {
  id: P,
  name: 'PPLL',
  splitType: 'ppll',
  schedule: {
    kind: 'weekday',
    weeks: [week({ mon: push.id, tue: legs.id, thu: pull.id, fri: legs.id })],
  },
  cycleWeeks: 1,
  deloadWeeks: [],
  note: '',
  dayTemplates: [push, pull, legs],
};
