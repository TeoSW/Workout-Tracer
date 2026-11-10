import {
  added,
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

/**
 * The user's 5-week calisthenics cycle, from Calisthenics_5-week_cycle.xlsx. Weeks 1-2 are
 * intensity, weeks 3-4 volume, and week 5 is the deload, which the app's rule makes from the
 * volume days by halving the sets, rounded up. That matches the sheet's deload tables.
 */

const P = 'tpl-cal5';
const WEAK_POINT = `${P}-weak-point`;
const MIN = 60;

const accessory = choice(
  WEAK_POINT,
  'Weak-point accessory',
  3,
  [
    option(
      'planche-lean',
      3,
      secs(20),
      "Your shoulders don't get far enough in front of your hands. This cycle's pick in your sheet.",
    ),
    option(
      'front-lever-raises',
      3,
      { ...reps(5), bandIds: [] },
      "Your front lever line is fine, but you can't hold it horizontal.",
    ),
    option('hollow-body-hold', 3, secs(30), 'Your body line breaks on either element.'),
  ],
  { restSec: MIN, note: 'RPE 7.' },
);

type Phase = 'intensity' | 'volume';

function plancheComplex(sets: number, phase: Phase): BlockInput {
  const n = phase === 'intensity' ? 5 : 8;
  return ex(
    'planche-complex',
    sets,
    {
      parts: [holdPart('Hold', n), repPart('Push-up', n)],
      ...bands(phase === 'intensity' ? 'band-25' : 'band-35'),
      progressionLevel: 'current',
    },
    {
      restSec: 4.5 * MIN,
      note:
        phase === 'intensity'
          ? 'RPE 8. Rest 4-5 min. Use 25+5kg if a set fails.'
          : 'RPE 8. Rest 4-5 min.',
    },
  );
}

function planchePress(phase: Phase): BlockInput {
  return ex(
    'planche-press',
    2,
    { ...reps(1, 3), ...bands(...(phase === 'intensity' ? ['band-35'] : ['band-35', 'band-5'])) },
    { restSec: 4.5 * MIN, note: 'RPE 9. Rest 4-5 min.' },
  );
}

function frontLeverComplex(sets: number, phase: Phase): BlockInput {
  const n = phase === 'intensity' ? 5 : 8;
  return ex(
    'front-lever-complex',
    sets,
    {
      parts: [repPart('Touch', n), repPart('Pull-up', 5), holdPart('Hold', n)],
      ...bands(phase === 'intensity' ? 'band-25' : 'band-15'),
      progressionLevel: 'current',
    },
    {
      restSec: 3 * MIN,
      note:
        phase === 'intensity'
          ? 'RPE 8. Band 25kg on one loop, about 12.5kg. Use 15kg on a double loop if a set fails.'
          : 'RPE 8. Band 15kg on a double loop.',
    },
  );
}

function heavyBlocks(phase: Phase, plancheSets: number, leverSets: number): BlockInput[] {
  const intensity = phase === 'intensity';
  return [
    plancheComplex(plancheSets, phase),
    planchePress(phase),
    frontLeverComplex(leverSets, phase),
    accessory,
    ex(
      'weighted-pull-ups',
      2,
      { ...reps(6, 8), ...added(intensity ? 20 : 15) },
      { restSec: 2.5 * MIN, note: 'RPE 8. Add 2.5kg when both sets reach 8 reps at 1-2 RIR.' },
    ),
    ex(
      'weighted-dips',
      2,
      { ...(intensity ? reps(8) : reps(8, 10)), ...added(intensity ? 25 : 20) },
      { restSec: 2.5 * MIN, note: 'RPE 7. Add 2.5kg when both sets reach the top at 1-2 RIR.' },
    ),
    ex(
      'cable-lateral-raise',
      2,
      { ...(intensity ? reps(8, 10) : reps(6, 8)), ...kg(15) },
      { restSec: 1.5 * MIN, note: 'RPE 8. Cable on 2:1, so about 7.5kg on the arm.' },
    ),
    ex('bicep-curl', 2, reps(8, 10), {
      restSec: 1.5 * MIN,
      note: intensity
        ? 'One preacher curl set at RPE 6 (7.5kg), then one dumbbell curl set at RPE 7 (15kg).'
        : 'One preacher curl set, then one dumbbell curl set, 15kg.',
    }),
  ];
}

const PLANCHE_NOTE = 'Planche first. Breathe well during the planche.';

const heavy1Intensity = dayTemplate(
  P,
  `${P}-heavy1-int`,
  'Heavy 1, planche (intensity)',
  'skill_heavy',
  heavyBlocks('intensity', 3, 2),
  { note: PLANCHE_NOTE },
);
const heavy1Volume = dayTemplate(
  P,
  `${P}-heavy1-vol`,
  'Heavy 1, planche (volume)',
  'skill_heavy',
  heavyBlocks('volume', 3, 3),
  { note: PLANCHE_NOTE },
);
const heavy2Intensity = dayTemplate(
  P,
  `${P}-heavy2-int`,
  'Heavy 2, front lever (intensity)',
  'skill_heavy',
  heavyBlocks('intensity', 2, 3),
  { note: 'The front lever is the focus, but the planche still goes first.' },
);
const heavy2Volume = dayTemplate(
  P,
  `${P}-heavy2-vol`,
  'Heavy 2, front lever (volume)',
  'skill_heavy',
  heavyBlocks('volume', 2, 3),
  { note: 'The front lever is the focus, but the planche still goes first.' },
);

const light = dayTemplate(
  P,
  `${P}-light`,
  'Light',
  'skill_light',
  [
    ex(
      'planche-hold',
      3,
      { ...secs(10), ...bands('band-25', 'band-15') },
      { restSec: 1.5 * MIN, note: 'Banded.' },
    ),
    ex(
      'planche-hold',
      1,
      { isMax: true, bandIds: [], progressionLevel: 'Advanced tuck' },
      { restSec: 3 * MIN, note: 'Advanced tuck, no band, max hold.' },
    ),
    ex(
      'front-lever-hold',
      1,
      { isMax: true, bandIds: [], progressionLevel: 'current' },
      { restSec: 3 * MIN, note: 'No band, max hold.' },
    ),
    ex(
      'front-lever-hold',
      3,
      { ...secs(10), ...bands('band-5') },
      { restSec: 1.5 * MIN, note: 'Banded.' },
    ),
  ],
  { note: 'Planche first.' },
);

const test = dayTemplate(
  P,
  `${P}-test`,
  'Test',
  'test',
  [
    ex('warm-up', 1, {}, { note: '10 min, plus 2 easy sets of each element.' }),
    ex(
      'planche-hold',
      2,
      { isMax: true, bandIds: [], progressionLevel: 'current' },
      { restSec: 3 * MIN, note: 'Two attempts at your current progression, no band.' },
    ),
    ex(
      'front-lever-hold',
      2,
      { isMax: true, bandIds: [], progressionLevel: 'current' },
      { restSec: 3 * MIN, note: 'Two attempts at your current progression, no band.' },
    ),
  ],
  {
    deloadExempt: true,
    note: "Planche first. Film yourself from the side. Write down your best time and what fails first, then pick next cycle's accessory.",
  },
);

const legs = dayTemplate(
  P,
  `${P}-legs`,
  'Legs',
  'hypertrophy',
  [
    ex('lumbar-extension', 2, { ...reps(10), ...kg(20, 25) }, { note: 'Hip hinge. RPE 7.' }),
    ex('squat', 3, { ...reps(8), ...kg(20, 40) }, { note: 'Squat machine or BSS. RPE 9.' }),
    ex('hip-thrust', 2, { ...reps(8), ...kg(25, 30) }, { note: 'Machine. RPE 8.' }),
    ex('leg-extension', 2, { ...reps(10), ...kg(30, 40) }, { note: 'Machine. RPE 8.' }),
    ex('hamstring-curl', 2, reps(8), { note: '7.5kg per side. RPE 7.' }),
    ex('adductors', 2, { ...reps(8), ...kg(43, 50) }, { note: 'Inner. RPE 8.' }),
    ex('abductors', 2, { ...reps(10, 12), ...kg(84, 97) }, { note: 'Outer. RPE 7.' }),
    ex('calf-raise', 2, { ...reps(8), ...kg(70, 80) }, { note: 'RPE 7.' }),
    ex('oblique-extension', 2, { ...reps(8, 10), ...kg(6) }, { note: '6kg each side. RPE 8.' }),
    ex(
      'ab-crunch',
      2,
      { ...reps(8), ...kg(35, 40) },
      { note: 'Cable on 2:1, so 2.5kg on the stack is 5kg. RPE 7.' },
    ),
  ],
  { deloadExempt: true, note: 'Every week, deload included.' },
);

const intensityWeek = week({
  tue: heavy1Intensity.id,
  thu: light.id,
  sat: heavy2Intensity.id,
  sun: legs.id,
});
const volumeWeek = week({
  tue: heavy1Volume.id,
  thu: light.id,
  sat: heavy2Volume.id,
  sun: legs.id,
});

export const CALISTHENICS_5_WEEK: BuiltInTemplate = {
  id: P,
  name: 'Calisthenics 5-week cycle',
  splitType: 'calisthenics_cycle',
  schedule: {
    kind: 'weekday',
    weeks: [
      intensityWeek,
      intensityWeek,
      volumeWeek,
      volumeWeek,
      week({ tue: heavy1Volume.id, thu: light.id, sat: test.id, sun: legs.id }),
    ],
  },
  cycleWeeks: 5,
  deloadWeeks: [5],
  note: [
    'Weeks 1-2 intensity, weeks 3-4 volume, week 5 deload and test, then again.',
    'Planche always first, on every day, and breathe well during it.',
    'Complexes: once every set is clean two sessions in a row, use the next thinner band.',
    'Weighted pull-ups and dips: add 2.5kg when both sets reach the top of the range at 1-2 RIR.',
    'If elbow or wrist pain lasts until the next heavy day, do a light day instead.',
  ].join(' '),
  dayTemplates: [heavy1Intensity, heavy1Volume, light, heavy2Intensity, heavy2Volume, test, legs],
};
