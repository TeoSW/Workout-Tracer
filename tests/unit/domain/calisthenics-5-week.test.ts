import { describe, expect, it } from 'vitest';
import { addDays } from '../../../src/domain/dates';
import { applyDeload, isDeloadDay } from '../../../src/domain/deload';
import { SEED_EXERCISES } from '../../../src/domain/fixtures/exercises';
import { CALISTHENICS_5_WEEK } from '../../../src/domain/fixtures/templates';
import { plannedDayTemplateId } from '../../../src/domain/schedule';
import type { Block } from '../../../src/domain/schemas';
import { ANCHOR, activeProgram } from './helpers';

const exercises = new Map(SEED_EXERCISES.map((e) => [e.id, e]));
const D = ANCHOR; // Monday of week 1

function sets(blocks: Block[]): number[] {
  return blocks.map((b) => b.setsMin);
}

describe('the Calisthenics 5-week cycle from the Excel sheet', () => {
  const { program, dayTemplates, dayName } = activeProgram(CALISTHENICS_5_WEEK);
  const dayOn = (week: number, weekday: number) =>
    dayName(plannedDayTemplateId(program, addDays(D, (week - 1) * 7 + weekday)));
  const day = (name: string) => {
    const found = dayTemplates.find((d) => d.name === name);
    if (!found) throw new Error(`No day ${name}`);
    return found;
  };

  it('follows the calendar: Monday rest, Tuesday Heavy 1, Thursday Light, Saturday Heavy 2, Sunday Legs', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => dayOn(1, d))).toEqual([
      'rest',
      'Heavy 1, planche (intensity)',
      'rest',
      'Light',
      'rest',
      'Heavy 2, front lever (intensity)',
      'Legs',
    ]);
    expect(dayOn(2, 1)).toBe('Heavy 1, planche (intensity)');
    expect(dayOn(3, 1)).toBe('Heavy 1, planche (volume)');
    expect(dayOn(4, 5)).toBe('Heavy 2, front lever (volume)');
    expect(dayOn(5, 1)).toBe('Heavy 1, planche (volume)');
    expect(dayOn(5, 5)).toBe('Test');
    expect(dayOn(6, 1)).toBe('Heavy 1, planche (intensity)'); // cycle 2, week 1
  });

  it('has the sets from the sheet, and week 5 halves the volume day like the Deload sheet', () => {
    expect(sets(day('Heavy 1, planche (intensity)').blocks)).toEqual([3, 2, 2, 3, 2, 2, 2, 2]);
    const volume = day('Heavy 1, planche (volume)');
    expect(sets(volume.blocks)).toEqual([3, 2, 3, 3, 2, 2, 2, 2]);
    expect(isDeloadDay(program, volume, addDays(D, 29))).toBe(true);
    expect(sets(applyDeload(volume.blocks, exercises))).toEqual([2, 1, 2, 2, 1, 1, 1, 1]);
    expect(sets(applyDeload(day('Light').blocks, exercises))).toEqual([2, 1, 1, 2]);
  });

  it('keeps Legs and the Test out of the deload', () => {
    expect(isDeloadDay(program, day('Legs'), addDays(D, 34))).toBe(false);
    expect(isDeloadDay(program, day('Test'), addDays(D, 33))).toBe(false);
  });

  it('carries the bands and rests from the sheet', () => {
    const [complex, press, lever] = day('Heavy 1, planche (volume)').blocks;
    expect(complex?.target.bandIds).toEqual(['band-35']);
    expect(complex?.restSec).toBe(270);
    expect(press?.target.bandIds).toEqual(['band-35', 'band-5']);
    expect(lever?.target.bandIds).toEqual(['band-15']);
    expect(lever?.restSec).toBe(180);
  });

  it('plans the RPE from the sheet as an effort, and one per curl set', () => {
    const heavy = day('Heavy 1, planche (intensity)');
    const byExercise = (id: string) =>
      heavy.blocks.find((b) => b.kind === 'exercise' && b.exerciseId === id);
    expect(byExercise('weighted-pull-ups')?.target.rir).toBe(2); // RPE 8
    expect(byExercise('planche-press')?.target.rir).toBe(1); // RPE 9
    expect(byExercise('bicep-curl')?.setTargets).toEqual([
      { rir: 4, note: 'Preacher curl, 7.5kg' },
      { rir: 3, note: 'Dumbbell curl, 15kg' },
    ]);
  });

  it("lets the test pick next cycle's weak-point accessory", () => {
    const slot = day('Heavy 1, planche (intensity)').blocks.find((b) => b.kind === 'choice');
    expect(slot?.kind === 'choice' && slot.choiceSlot.options.map((o) => o.exerciseId)).toEqual([
      'planche-lean',
      'front-lever-raises',
      'hollow-body-hold',
    ]);
  });
});
