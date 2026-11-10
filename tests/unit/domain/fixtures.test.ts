import { describe, expect, it } from 'vitest';
import { SEED_BANDS } from '../../../src/domain/fixtures/bands';
import { PROGRESSION_LADDER, SEED_EXERCISES } from '../../../src/domain/fixtures/exercises';
import {
  BUILT_IN_TEMPLATES,
  PROGRAM_A,
  PROGRAM_C,
  blankTemplate,
  templatesForSplit,
} from '../../../src/domain/fixtures/templates';
import {
  BandSchema,
  DayTemplateSchema,
  ExerciseSchema,
  ProgramSchema,
  SPLIT_TYPES,
  type Block,
  type DayTemplate,
} from '../../../src/domain/schemas';
import { instantiateTemplate } from '../../../src/domain/templates';
import { counterIds } from './helpers';

const exerciseIds = new Set(SEED_EXERCISES.map((e) => e.id));
const bandIds = new Set(SEED_BANDS.map((b) => b.id));
const allTemplates = [...BUILT_IN_TEMPLATES, ...SPLIT_TYPES.map(blankTemplate)];

function exerciseIdsOf(block: Block): string[] {
  return block.kind === 'exercise'
    ? [block.exerciseId]
    : block.choiceSlot.options.map((o) => o.exerciseId);
}

function day(name: string): DayTemplate {
  const found = PROGRAM_C.dayTemplates.find((d) => d.name === name);
  if (!found) throw new Error(`No day ${name}`);
  return found;
}

describe('seed bands', () => {
  it('has 5, 15, 25 and 35kg bands', () => {
    expect(SEED_BANDS.map((b) => BandSchema.parse(b).ratedKg)).toEqual([5, 15, 25, 35]);
  });
});

describe('seed exercises', () => {
  it('has 54 exercises from the spec plus 6 for the presets, all valid, with unique ids and names', () => {
    expect(SEED_EXERCISES).toHaveLength(60);
    for (const e of SEED_EXERCISES) ExerciseSchema.parse(e);
    expect(exerciseIds.size).toBe(60);
    expect(new Set(SEED_EXERCISES.map((e) => e.name.toLowerCase())).size).toBe(60);
  });

  it('only points alternatives at exercises that exist', () => {
    for (const e of SEED_EXERCISES) {
      for (const id of e.alternativeIds) expect(exerciseIds.has(id)).toBe(true);
    }
  });

  it('matches spot checks from section 9.2', () => {
    const byName = new Map(SEED_EXERCISES.map((e) => [e.name, e]));
    expect(byName.get('Lateral Raise')?.alternativeIds).toHaveLength(3);
    expect(byName.get('Tricep Above Head')?.alternativeIds).toHaveLength(3);
    expect(byName.get('Upper Chest')?.loadUnit).toBe('per_hand');
    expect(byName.get('Leg Extension')?.loadUnit).toBe('per_side');
    expect(byName.get('Bulgarian Split Squat')?.unilateral).toBe(true);
    expect(byName.get('Planche Complex')?.progressionLadder).toEqual(PROGRESSION_LADDER);
    expect(byName.get('Deadlift')?.primaryMuscles).toEqual(['glutes', 'hamstrings']);
    expect(byName.get('540')?.trackingType).toBe('attempts');
    expect(byName.get('Warm-up')?.defaultRestSec).toBe(0);
    expect(byName.get('Plank')?.defaultRestSec).toBe(60);
  });
});

describe('built-in templates', () => {
  it('are all valid and only reference known exercises, bands and days', () => {
    for (const t of allTemplates) {
      const dayIds = new Set(t.dayTemplates.map((d) => d.id));
      for (const d of t.dayTemplates) {
        DayTemplateSchema.parse(d);
        for (const block of d.blocks) {
          for (const id of exerciseIdsOf(block)) expect(exerciseIds.has(id), id).toBe(true);
          for (const id of block.target.bandIds ?? []) expect(bandIds.has(id)).toBe(true);
        }
      }
      const refs =
        t.schedule.kind === 'rotation'
          ? t.schedule.sequence
          : t.schedule.weeks.flatMap((w) => Object.values(w).filter((v) => v !== null));
      for (const ref of refs) expect(dayIds.has(ref as string), ref as string).toBe(true);
    }
  });

  it('has unique block ids inside each template', () => {
    for (const t of allTemplates) {
      const ids = t.dayTemplates.flatMap((d) => d.blocks.map((b) => b.id));
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('offers built-in templates per split type plus a blank one', () => {
    expect(templatesForSplit('ulu_lul_rotation').map((t) => t.name)).toEqual(['ULU/LUL', 'Blank']);
    expect(templatesForSplit('ppll').map((t) => t.name)).toEqual(['PPLL', 'Blank']);
    expect(templatesForSplit('custom').map((t) => t.name)).toEqual(['Blank']);
  });

  it('builds Program A as a 4-day rotation, 3 sessions a week', () => {
    expect(PROGRAM_A.schedule).toMatchObject({
      kind: 'rotation',
      sessionsPerWeek: 3,
      preferredWeekdays: ['mon', 'wed', 'fri'],
    });
    const names = PROGRAM_A.dayTemplates.map((d) => d.name);
    expect(names).toEqual(['Upper A', 'Lower A', 'Upper B', 'Lower B']);
    const pullUps = PROGRAM_A.dayTemplates[0]?.blocks[0];
    expect(pullUps).toMatchObject({
      exerciseId: 'pull-ups',
      setsMin: 3,
      target: { repsMin: 8, repsMax: 12, bandIds: ['band-35', 'band-15'] },
    });
  });

  it('builds Program C with Test on Saturday of week 6 and Legs every Sunday', () => {
    expect(PROGRAM_C.cycleWeeks).toBe(6);
    expect(PROGRAM_C.deloadWeeks).toEqual([6]);
    if (PROGRAM_C.schedule.kind !== 'weekday') throw new Error('expected weekday grid');
    const weeks = PROGRAM_C.schedule.weeks;
    expect(weeks[5]?.sat).toBe(day('Test').id);
    for (const w of weeks) expect(w.sun).toBe(day('Legs').id);
    expect(weeks[1]?.wed).toBe(day('Dynamics').id);
    expect(weeks[0]?.wed).toBe(day('Light (front lever first)').id);
    expect(day('Legs').deloadExempt).toBe(true);
    expect(day('Test').deloadExempt).toBe(true);
  });

  it('swaps blocks 2 and 3 between the two Heavy days and shares one choice slot', () => {
    const pl = day('Heavy (planche first)').blocks;
    const fl = day('Heavy (front lever first)').blocks;
    const shape = (b: Block) => ({ ids: exerciseIdsOf(b), setsMin: b.setsMin, target: b.target });
    const swapped = [pl[0], pl[2], pl[1], ...pl.slice(3)].filter((b) => b !== undefined);
    expect(swapped).toHaveLength(pl.length);
    expect(fl.map(shape)).toEqual(swapped.map(shape));
    const slots = [pl, fl].map((blocks) =>
      blocks.flatMap((b) => (b.kind === 'choice' ? [b.choiceSlot.id] : [])),
    );
    expect(slots[0]).toHaveLength(1);
    expect(slots[0]).toEqual(slots[1]);
  });
});

describe('instantiateTemplate', () => {
  it('copies a template into a program with fresh ids and consistent references', () => {
    const { program, dayTemplates } = instantiateTemplate(PROGRAM_C, { newId: counterIds('n') });
    ProgramSchema.parse(program);
    const oldIds = new Set([
      PROGRAM_C.id,
      ...PROGRAM_C.dayTemplates.flatMap((d) => [d.id, ...d.blocks.map((b) => b.id)]),
    ]);
    const newIds = [
      program.id,
      ...dayTemplates.flatMap((d) => [d.id, ...d.blocks.map((b) => b.id)]),
    ];
    for (const id of newIds) expect(oldIds.has(id)).toBe(false);

    const dayIds = new Set(dayTemplates.map((d) => d.id));
    for (const d of dayTemplates) expect(d.programId).toBe(program.id);
    if (program.schedule.kind !== 'weekday') throw new Error('expected weekday grid');
    for (const w of program.schedule.weeks) {
      for (const v of Object.values(w)) if (v !== null) expect(dayIds.has(v)).toBe(true);
    }
    expect(program).toMatchObject({
      name: 'Calisthenics 6-week cycle',
      anchorDate: null,
      active: false,
      choiceSelections: [],
    });

    const slotIds = dayTemplates.flatMap((d) =>
      d.blocks.flatMap((b) => (b.kind === 'choice' ? [b.choiceSlot.id] : [])),
    );
    expect(slotIds).toHaveLength(2);
    expect(slotIds[0]).toBe(slotIds[1]);
    expect(slotIds[0]).not.toBe('tpl-c-weak-point');
  });

  it('can rename the copy and leaves the template untouched', () => {
    const before = structuredClone(PROGRAM_A);
    const { program } = instantiateTemplate(PROGRAM_A, { newId: counterIds('x'), name: 'Mine' });
    expect(program.name).toBe('Mine');
    expect(PROGRAM_A).toEqual(before);
  });
});
