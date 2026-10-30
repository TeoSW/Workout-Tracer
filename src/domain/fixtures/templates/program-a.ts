import { bands, dayTemplate, ex, kg, reps } from '../builders';
import type { BuiltInTemplate } from './types';

const P = 'tpl-a';
const r = reps(8, 12);

const upperA = dayTemplate(P, `${P}-upper-a`, 'Upper A', 'hypertrophy', [
  ex(
    'pull-ups',
    3,
    { ...r, ...bands('band-35', 'band-15') },
    {
      note: 'Start each rep by pulling the shoulders down.',
    },
  ),
  ex(
    'upper-chest',
    3,
    { ...r, ...kg(4) },
    { note: 'Different day from Military Press on purpose.' },
  ),
  ex(
    'kelso-shrug',
    3,
    { ...r, ...kg(7.5) },
    {
      note: 'Squeeze the shoulder blades and hold 1s at the top.',
    },
  ),
  ex('lateral-raise', 3, { ...r, ...kg(2) }),
  ex('tricep-above-head', 3, { ...r, ...kg(5) }),
]);

const upperB = dayTemplate(P, `${P}-upper-b`, 'Upper B', 'hypertrophy', [
  ex(
    'mid-back-row',
    3,
    { ...r, ...kg(25) },
    {
      note: 'Squeeze the shoulder blades at the end of each rep.',
    },
  ),
  ex(
    'reverse-fly',
    3,
    { ...r, ...kg(1, 2) },
    {
      note: 'Reverse pec deck or bent-over dumbbells. Superset with Push-ups if short on time.',
    },
  ),
  ex('military-press', 3, { ...r, ...kg(2) }),
  ex('push-ups-incline', 3, r, { note: 'Lower the surface to progress.' }),
  ex('bicep-curl', 3, { ...r, ...kg(3) }),
  ex('tricep-below-head', 3, { ...r, ...kg(10) }),
]);

const lowerA = dayTemplate(P, `${P}-lower-a`, 'Lower A', 'hypertrophy', [
  ex('squat', 3, { ...r, ...kg(10, 15) }),
  ex('hip-thrust', 3, { ...r, ...kg(15, 25) }),
  ex('leg-extension', 3, { ...r, ...kg(5, 7.5) }),
  ex(
    'hamstring-curl',
    3,
    { ...r, ...kg(5) },
    { note: 'Seated or standing; seated weight by feel.' },
  ),
  ex('calf-raise', 3, { ...r, ...kg(20) }),
]);

const lowerB = dayTemplate(P, `${P}-lower-b`, 'Lower B', 'hypertrophy', [
  ex('bulgarian-split-squat', 3, { ...r, ...kg(10, 15) }),
  ex('lumbar-extension', 3, { ...r, ...kg(10) }),
  ex('adductors', 3, { ...r, ...kg(25, 40) }, { note: 'First to drop when short on time.' }),
  ex('abductors', 3, { ...r, ...kg(25, 40) }),
  ex('ab-crunch', 3, { ...r, ...kg(15) }),
]);

export const PROGRAM_A: BuiltInTemplate = {
  id: P,
  name: 'ULU/LUL',
  splitType: 'ulu_lul_rotation',
  schedule: {
    kind: 'rotation',
    sequence: [upperA.id, lowerA.id, upperB.id, lowerB.id],
    sessionsPerWeek: 3,
    preferredWeekdays: ['mon', 'wed', 'fri'],
  },
  cycleWeeks: null,
  deloadWeeks: [],
  note: '',
  dayTemplates: [upperA, lowerA, upperB, lowerB],
};
