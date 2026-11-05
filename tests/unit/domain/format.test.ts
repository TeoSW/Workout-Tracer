import { describe, expect, it } from 'vitest';
import { SEED_BANDS } from '../../../src/domain/fixtures/bands';
import { SEED_EXERCISES } from '../../../src/domain/fixtures/exercises';
import { PROGRAM_A, PROGRAM_C } from '../../../src/domain/fixtures/templates';
import {
  formatBandLevel,
  formatCycleWeek,
  formatDuration,
  formatKg,
  formatLoad,
  formatPlanLine,
  formatSetsTarget,
} from '../../../src/domain/format';
import type { Block, DayTemplate, Exercise } from '../../../src/domain/schemas';

const exercisesById = new Map(SEED_EXERCISES.map((e) => [e.id, e]));
const bandsById = new Map(SEED_BANDS.map((b) => [b.id, b]));

function exercise(id: string): Exercise {
  const e = exercisesById.get(id);
  if (!e) throw new Error(`No exercise ${id}`);
  return e;
}

function day(days: DayTemplate[], name: string): DayTemplate {
  const d = days.find((x) => x.name === name);
  if (!d) throw new Error(`No day ${name}`);
  return d;
}

function line(block: Block | undefined): string {
  if (block?.kind !== 'exercise') throw new Error('expected an exercise block');
  return formatPlanLine(block, exercise(block.exerciseId), bandsById);
}

describe('formats from spec section 12', () => {
  it('writes kg without trailing zeros', () => {
    expect(formatKg(4)).toBe('4kg');
    expect(formatKg(12.5)).toBe('12.5kg');
    expect(formatKg(7.5)).toBe('7.5kg');
  });

  it('writes band levels with the heaviest band first', () => {
    expect(formatBandLevel(['band-15', 'band-35'], bandsById)).toBe('35+15kg');
    expect(formatBandLevel(['band-25'], bandsById)).toBe('25kg');
    expect(formatBandLevel([], bandsById)).toBe('no band');
  });

  it('writes loads per hand and per side, and ranges', () => {
    expect(formatLoad({ loadMinKg: 4 }, exercise('upper-chest'))).toBe('4kg/hand');
    expect(formatLoad({ loadMinKg: 1, loadMaxKg: 2 }, exercise('reverse-fly'))).toBe('1-2kg/hand');
    expect(formatLoad({ loadMinKg: 12.5 }, exercise('leg-extension'))).toBe('12.5kg/side');
    expect(formatLoad({ loadMinKg: 5, loadMaxKg: 7.5 }, exercise('leg-extension'))).toBe(
      '5-7.5kg/side',
    );
    expect(formatLoad({ loadMinKg: 25 }, exercise('mid-back-row'))).toBe('25kg');
    expect(formatLoad({ addedKg: 25 }, exercise('weighted-dips'))).toBe('+25kg');
    expect(formatLoad({}, exercise('squat'))).toBe('');
  });

  it('writes the cycle week', () => {
    expect(formatCycleWeek(3, 6)).toBe('Week 3 of 6');
  });

  it('writes durations', () => {
    expect(formatDuration(48 * 60_000)).toBe('48m');
    expect(formatDuration(65 * 60_000)).toBe('1h 05m');
    expect(formatDuration(20_000)).toBe('0m');
  });
});

describe('plan lines', () => {
  const upperA = day(PROGRAM_A.dayTemplates, 'Upper A');
  const lowerB = day(PROGRAM_A.dayTemplates, 'Lower B');
  const heavy = day(PROGRAM_C.dayTemplates, 'Heavy (planche first)');
  const light = day(PROGRAM_C.dayTemplates, 'Light (front lever first)');
  const dynamics = day(PROGRAM_C.dayTemplates, 'Dynamics');
  const test = day(PROGRAM_C.dayTemplates, 'Test');

  it('matches the logger mockup in section 6.2', () => {
    expect(line(upperA.blocks[0])).toBe('3 x 8-12 · band 35+15kg');
    expect(line(upperA.blocks[1])).toBe('3 x 8-12 · 4kg/hand');
  });

  it('marks unilateral sets', () => {
    expect(line(lowerB.blocks[0])).toBe('3 x 8-12 /leg · 10-15kg');
  });

  it('writes every tracking type', () => {
    expect(line(heavy.blocks[0])).toBe('');
    expect(line(heavy.blocks[1])).toBe('3 x hold 3s, press 3, push-up 3 · band 25kg');
    expect(line(heavy.blocks[4])).toBe('2 x 8 · +25kg');
    expect(line(light.blocks[1])).toBe('3-4 x 5-10s · no band');
    expect(line(dynamics.blocks[1])).toBe('4-6 attempts');
    expect(line(test.blocks[1])).toBe('2 x max · no band');
  });

  it('writes a sets and target summary on its own', () => {
    expect(formatSetsTarget({ setsMin: 3, target: { secondsMin: 30 } }, exercise('plank'))).toBe(
      '3 x 30s',
    );
    expect(formatSetsTarget({ setsMin: 2, target: {} }, exercise('squat'))).toBe('2 sets');
  });
});
