import {
  added,
  attempts,
  bands,
  choice,
  dayTemplate,
  ex,
  holdPart,
  kg,
  option,
  repPart,
  reps,
  secs,
  week,
  type BlockInput,
} from '../builders';
import type { BuiltInTemplate } from './types';

const P = 'tpl-c';
const WEAK_POINT = `${P}-weak-point`;
const COMPLEX_NOTE =
  'Hold first, while fresh. Thinner band once every set is clean two sessions in a row.';
const LIGHT_HOLD_NOTE =
  'Hardest progression you hold clean. Stop a few seconds before your limit. Move up a progression after 4 x 10s clean.';

const plancheComplex = ex(
  'planche-complex',
  3,
  {
    parts: [holdPart('Hold', 3), repPart('Press', 3), repPart('Push-up', 3)],
    ...bands('band-25'),
    progressionLevel: 'current',
  },
  { note: COMPLEX_NOTE },
);

const frontLeverComplex = ex(
  'front-lever-complex',
  3,
  {
    parts: [holdPart('Hold', 5), repPart('Touch', 5), repPart('Pull-up', 5)],
    ...bands('band-15'),
    progressionLevel: 'current',
  },
  { note: COMPLEX_NOTE },
);

const accessory = choice(WEAK_POINT, 'Weak-point accessory', 3, [
  option(
    'planche-lean',
    3,
    secs(15, 20),
    "You can't get your shoulders far enough in front of your hands.",
  ),
  option(
    'front-lever-raises',
    3,
    { ...reps(5), bandIds: [], progressionLevel: 'current' },
    "Your front lever line is fine but you can't hold horizontal. If 5 clean reps to horizontal don't happen, drop a progression; when 3 x 5 is easy, move up one.",
  ),
  option('hollow-body-hold', 3, secs(30), 'Your body line breaks on either element.'),
]);

function heavyBlocks(first: BlockInput, second: BlockInput): BlockInput[] {
  return [
    ex(
      'warm-up',
      1,
      {},
      {
        note: '10 min: wrists, scap push-ups, scap pull-ups, 1-2 easy sets of your working progression.',
      },
    ),
    first,
    second,
    accessory,
    ex(
      'weighted-dips',
      2,
      { ...reps(8), ...added(25) },
      {
        note: 'Add 2.5kg when both sets end at 1-2 RIR.',
      },
    ),
    ex(
      'weighted-pull-ups',
      2,
      { ...reps(6), ...added(20) },
      {
        note: 'Add 2.5kg when both sets end at 1-2 RIR.',
      },
    ),
    ex('lateral-raise', 3, reps(10, 15)),
    ex('bicep-curl', 2, reps(8, 12), {
      note: 'Strengthens the biceps tendon that straight-arm work loads.',
    }),
  ];
}

const lightHold = (exerciseId: string) =>
  ex(
    exerciseId,
    [3, 4],
    { ...secs(5, 10), bandIds: [], progressionLevel: 'current' },
    {
      note: LIGHT_HOLD_NOTE,
    },
  );

function lightBlocks(first: BlockInput, second: BlockInput): BlockInput[] {
  return [ex('warm-up', 1, {}, { note: '5 min.' }), first, second];
}

const testHold = (exerciseId: string) =>
  ex(exerciseId, 2, { isMax: true, bandIds: [], progressionLevel: 'current' }, { restSec: 180 });

const heavyPl = dayTemplate(
  P,
  `${P}-heavy-pl`,
  'Heavy (planche first)',
  'skill_heavy',
  heavyBlocks(plancheComplex, frontLeverComplex),
);
const heavyFl = dayTemplate(
  P,
  `${P}-heavy-fl`,
  'Heavy (front lever first)',
  'skill_heavy',
  heavyBlocks(frontLeverComplex, plancheComplex),
);
const lightFl = dayTemplate(
  P,
  `${P}-light-fl`,
  'Light (front lever first)',
  'skill_light',
  lightBlocks(lightHold('front-lever-hold'), lightHold('planche-hold')),
);
const lightPl = dayTemplate(
  P,
  `${P}-light-pl`,
  'Light (planche first)',
  'skill_light',
  lightBlocks(lightHold('planche-hold'), lightHold('front-lever-hold')),
);
const dynamics = dayTemplate(
  P,
  `${P}-dynamics`,
  'Dynamics',
  'dynamics',
  [
    ex('warm-up', 1, {}, { note: '10 min: shoulders, wrists, swings, kips.' }),
    ex('360', 1, attempts(4, 6)),
    ex('540', 1, attempts(4, 6)),
    ex('shrimp-flip', 1, attempts(4, 6)),
  ],
  {
    note: "Start with the element you're learning, while fresh. Only clean attempts count. Rest fully between attempts and stop when grip or precision drops.",
  },
);
const test = dayTemplate(
  P,
  `${P}-test`,
  'Test',
  'test',
  [
    ex('warm-up', 1, {}, { note: '10 min, plus 2 easy sets of each element.' }),
    testHold('planche-hold'),
    testHold('front-lever-hold'),
  ],
  {
    deloadExempt: true,
    note: "Planche first. Film yourself from the side. Write down the best time and what fails first, then pick next cycle's accessory.",
  },
);
const legs = dayTemplate(
  P,
  `${P}-legs`,
  'Legs',
  'hypertrophy',
  [
    ex('lumbar-extension', 3, { ...reps(10), ...kg(15) }),
    ex('bulgarian-split-squat', 2, { ...reps(10), ...kg(20) }),
    ex('squat', 1, { ...reps(10), ...kg(20) }),
    ex('hip-thrust', 2, { ...reps(10), ...kg(25) }),
    ex('leg-extension', 2, { ...reps(10), ...kg(12.5) }),
    ex('hamstring-curl', 2, { ...reps(10), ...kg(10) }, { note: 'Standing.' }),
    ex('adductors', 2, { ...reps(10), ...kg(80) }),
    ex('abductors', 2, { ...reps(10), ...kg(50) }),
    ex('calf-raise', 2, { ...reps(10), ...kg(50) }),
    ex('ab-crunch', 3, { ...reps(10), ...kg(25) }),
  ],
  { deloadExempt: true },
);

const normalWeek = (wed: string) =>
  week({ mon: heavyPl.id, wed, fri: heavyFl.id, sat: lightPl.id, sun: legs.id });

export const PROGRAM_C: BuiltInTemplate = {
  id: P,
  name: 'Calisthenics 6-week cycle',
  splitType: 'calisthenics_cycle',
  schedule: {
    kind: 'weekday',
    weeks: [
      normalWeek(lightFl.id),
      normalWeek(dynamics.id),
      normalWeek(lightFl.id),
      normalWeek(dynamics.id),
      normalWeek(lightFl.id),
      week({ mon: heavyPl.id, wed: lightFl.id, fri: heavyFl.id, sat: test.id, sun: legs.id }),
    ],
  },
  cycleWeeks: 6,
  deloadWeeks: [6],
  note: 'If elbow or wrist pain lasts until the next session, switch to 3 sessions a week with a rest day between them.',
  dayTemplates: [heavyPl, heavyFl, lightFl, lightPl, dynamics, test, legs],
};
