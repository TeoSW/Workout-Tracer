import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES } from '../../../src/domain/fixtures/exercises';
import { CALISTHENICS_5_WEEK, PROGRAM_A } from '../../../src/domain/fixtures/templates';
import { resolvePlan } from '../../../src/domain/plan';
import { daysForWeek } from '../../../src/domain/week-days';
import { ANCHOR, activeProgram } from './helpers';

const exercises = new Map(SEED_EXERCISES.map((e) => [e.id, e]));

describe('starting a workout as a chosen week', () => {
  const { program, dayTemplates, dayName } = activeProgram(CALISTHENICS_5_WEEK);

  it("lists the week's days in order, then the rest of the program", () => {
    const week3 = daysForWeek(program, dayTemplates, 3);
    expect(week3.planned.map((d) => [d.weekday, dayName(d.dayTemplateId)])).toEqual([
      ['tue', 'Heavy 1, planche (volume)'],
      ['thu', 'Light'],
      ['sat', 'Heavy 2, front lever (volume)'],
      ['sun', 'Legs'],
    ]);
    expect(week3.others.map((d) => dayName(d.dayTemplateId))).toEqual([
      'Heavy 1, planche (intensity)',
      'Heavy 2, front lever (intensity)',
      'Test',
    ]);
  });

  it('lists a rotation in its order, each day once', () => {
    const a = activeProgram(PROGRAM_A);
    const days = daysForWeek(a.program, a.dayTemplates, 1);
    expect(days.planned.map((d) => a.dayName(d.dayTemplateId))).toEqual([
      'Upper A',
      'Lower A',
      'Upper B',
      'Lower B',
    ]);
    expect(days.others).toEqual([]);
  });

  it('applies the deload of the chosen week, not the calendar week', () => {
    const volume = dayTemplates.find((d) => d.name === 'Heavy 1, planche (volume)');
    if (!volume) throw new Error('missing day');
    // ANCHOR is in week 1, so the calendar says no deload.
    const asWeek5 = resolvePlan({
      program,
      dayTemplate: volume,
      date: ANCHOR,
      exercisesById: exercises,
      cycleWeek: 5,
    });
    expect(asWeek5).toMatchObject({ isDeload: true, cycleWeek: 5, cycleNumber: 1 });
    expect(asWeek5.blocks[0]?.setsMin).toBe(2);
    const asCalendar = resolvePlan({
      program,
      dayTemplate: volume,
      date: ANCHOR,
      exercisesById: exercises,
    });
    expect(asCalendar).toMatchObject({ isDeload: false, cycleWeek: 1 });
    expect(asCalendar.blocks[0]?.setsMin).toBe(3);
  });
});
