import { describe, expect, it } from 'vitest';
import { addDays } from '../../../src/domain/dates';
import { PROGRAM_A, PROGRAM_C } from '../../../src/domain/fixtures/templates';
import {
  cyclePosition,
  latestFinishedSession,
  nextRotationIndex,
  plannedDayTemplateId,
  rotationIndexForPick,
  setCurrentWeek,
} from '../../../src/domain/schedule';
import type { Program, Session } from '../../../src/domain/schemas';
import { todayPlan } from '../../../src/domain/today';
import { ANCHOR, activeProgram, makeSession } from './helpers';

const D = ANCHOR;

describe('cyclePosition', () => {
  const { program } = activeProgram(PROGRAM_C);

  it('follows the section 5 formulas', () => {
    expect(cyclePosition(program, D)).toEqual({
      weeksSinceAnchor: 0,
      cycleNumber: 1,
      cycleWeek: 1,
    });
    expect(cyclePosition(program, addDays(D, 6))).toMatchObject({ cycleNumber: 1, cycleWeek: 1 });
    expect(cyclePosition(program, addDays(D, 7))).toMatchObject({ cycleNumber: 1, cycleWeek: 2 });
    expect(cyclePosition(program, addDays(D, 41))).toMatchObject({ cycleNumber: 1, cycleWeek: 6 });
    expect(cyclePosition(program, addDays(D, 42))).toMatchObject({ cycleNumber: 2, cycleWeek: 1 });
  });

  it('gives cycle 0 or less before the anchor, with a non-negative cycle week', () => {
    expect(cyclePosition(program, addDays(D, -1))).toEqual({
      weeksSinceAnchor: -1,
      cycleNumber: 0,
      cycleWeek: 6,
    });
    expect(cyclePosition(program, addDays(D, -43))).toEqual({
      weeksSinceAnchor: -7,
      cycleNumber: -1,
      cycleWeek: 6,
    });
  });

  it('is null without an anchor or a cycle length', () => {
    expect(cyclePosition({ ...program, anchorDate: null }, D)).toBeNull();
    expect(cyclePosition(activeProgram(PROGRAM_A).program, D)).toBeNull();
  });
});

describe('setCurrentWeek', () => {
  it('moves the anchor so today falls in week N', () => {
    const { program } = activeProgram(PROGRAM_C);
    const today = '2026-12-17'; // a Thursday
    for (const n of [1, 3, 6]) {
      const moved = { ...program, anchorDate: setCurrentWeek(program, today, n) };
      expect(cyclePosition(moved, today)).toMatchObject({ cycleNumber: 1, cycleWeek: n });
      expect(moved.anchorDate).toBe(addDays('2026-12-14', -7 * (n - 1)));
    }
  });

  it('rejects a week outside the cycle', () => {
    const { program } = activeProgram(PROGRAM_C);
    expect(() => setCurrentWeek(program, D, 7)).toThrow();
    expect(() => setCurrentWeek(program, D, 0)).toThrow();
  });
});

describe('acceptance 3: Program C weekday grid', () => {
  const { program, dayName } = activeProgram(PROGRAM_C);
  const planned = (offset: number) => dayName(plannedDayTemplateId(program, addDays(D, offset)));

  it('plans the right day for each offset', () => {
    expect(planned(0)).toBe('Heavy (planche first)');
    expect(planned(1)).toBe('rest');
    expect(planned(2)).toBe('Light (front lever first)');
    expect(planned(9)).toBe('Dynamics');
    expect(planned(40)).toBe('Test');
    expect(planned(42)).toBe('Heavy (planche first)');
    expect(cyclePosition(program, addDays(D, 42))).toMatchObject({ cycleNumber: 2, cycleWeek: 1 });
  });

  it('plans Legs on every Sunday across two cycles', () => {
    for (let week = 0; week < 12; week++) expect(planned(6 + week * 7)).toBe('Legs');
  });
});

describe('rotations', () => {
  it('acceptance 2: picks the right day after either Legs session in [Push, Legs, Pull, Legs]', () => {
    const program: Program = {
      id: 'p',
      name: 'PLPL',
      splitType: 'custom',
      schedule: {
        kind: 'rotation',
        sequence: ['push', 'legs', 'pull', 'legs'],
        sessionsPerWeek: 4,
      },
      cycleWeeks: null,
      deloadWeeks: [],
      anchorDate: D,
      choiceSelections: [],
      manualDeloadWeeks: [],
      note: '',
      active: true,
      archived: false,
    };
    const seq = ['push', 'legs', 'pull', 'legs'];
    expect(seq[nextRotationIndex(program, 1)]).toBe('pull');
    expect(seq[nextRotationIndex(program, 3)]).toBe('push');
    expect(nextRotationIndex(program, null)).toBe(0);

    // Starting Legs by hand while the pointer is on Pull lands on the second Legs.
    expect(rotationIndexForPick(program, 2, 'legs')).toBe(3);
    // From the second Legs, Push is the first entry after the pointer, wrapping around.
    expect(rotationIndexForPick(program, 3, 'push')).toBe(0);
    expect(rotationIndexForPick(program, 0, 'push')).toBe(0);
    expect(() => rotationIndexForPick(program, 0, 'nope')).toThrow();
  });

  it('acceptance 1: Program A runs Upper A, Lower A, Upper B, Lower B over 12 sessions on Mon, Wed, Fri', () => {
    const { program, dayName } = activeProgram(PROGRAM_A);
    const sessions: Session[] = [];
    const weeks: string[][] = [];
    for (let w = 0; w < 4; w++) {
      const names: string[] = [];
      for (const offset of [0, 2, 4]) {
        const date = addDays(D, w * 7 + offset);
        const plan = todayPlan({ program, sessions, today: date });
        if (plan.today.status !== 'planned') throw new Error(`expected a planned day on ${date}`);
        names.push(dayName(plan.today.day.dayTemplateId));
        sessions.push(
          makeSession({
            date,
            programId: program.id,
            dayTemplateId: plan.today.day.dayTemplateId,
            rotationIndex: plan.today.day.rotationIndex,
          }),
        );
      }
      weeks.push(names);
    }
    expect(weeks).toEqual([
      ['Upper A', 'Lower A', 'Upper B'],
      ['Lower B', 'Upper A', 'Lower A'],
      ['Upper B', 'Lower B', 'Upper A'],
      ['Lower A', 'Upper B', 'Lower B'],
    ]);
  });

  it('uses the latest finished session of this program only', () => {
    const sessions = [
      makeSession({ date: D, programId: 'p', rotationIndex: 2, finishedAt: 300 }),
      makeSession({ date: D, programId: 'p', rotationIndex: 1, finishedAt: 100 }),
      makeSession({ date: D, programId: 'other', rotationIndex: 0, finishedAt: 900 }),
      makeSession({
        date: D,
        programId: 'p',
        rotationIndex: 3,
        status: 'active',
        finishedAt: null,
      }),
    ];
    expect(latestFinishedSession(sessions, 'p')?.rotationIndex).toBe(2);
  });
});

describe('todayPlan', () => {
  it('shows a finished planned day as done and points at the next planned day', () => {
    const { program, dayName } = activeProgram(PROGRAM_C);
    const heavy = plannedDayTemplateId(program, D);
    const done = makeSession({ date: D, programId: program.id, dayTemplateId: heavy });
    const plan = todayPlan({ program, sessions: [done], today: D });
    expect(plan.today).toEqual({ status: 'done', sessionId: done.id, dayTemplateId: heavy });
    expect(plan.next?.date).toBe(addDays(D, 2));
    expect(dayName(plan.next?.dayTemplateId ?? null)).toBe('Light (front lever first)');
  });

  it('reports rest days with the next planned day and the cycle position', () => {
    const { program, dayName } = activeProgram(PROGRAM_C);
    const plan = todayPlan({ program, sessions: [], today: addDays(D, 38) }); // week 6 Thursday
    expect(plan.today).toEqual({ status: 'rest' });
    expect(plan.cycle).toEqual({ cycleNumber: 1, cycleWeek: 6, cycleWeeks: 6 });
    expect(plan.isDeloadWeek).toBe(true);
    expect(dayName(plan.next?.dayTemplateId ?? null)).toBe('Heavy (front lever first)');
  });

  it('does not shift missed weekday sessions', () => {
    const { program, dayName } = activeProgram(PROGRAM_C);
    const plan = todayPlan({ program, sessions: [], today: addDays(D, 2) });
    expect(plan.today.status === 'planned' && dayName(plan.today.day.dayTemplateId)).toBe(
      'Light (front lever first)',
    );
  });

  it('shows a rotation as done when its latest session finished today', () => {
    const { program, dayName } = activeProgram(PROGRAM_A);
    const s = makeSession({ date: D, programId: program.id, rotationIndex: 0 });
    const plan = todayPlan({ program, sessions: [s], today: D });
    expect(plan.today.status).toBe('done');
    expect(plan.next).toMatchObject({ rotationIndex: 1, date: null });
    expect(dayName(plan.next?.dayTemplateId ?? null)).toBe('Lower A');
  });
});
