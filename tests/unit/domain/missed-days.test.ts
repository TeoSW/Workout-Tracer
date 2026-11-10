import { describe, expect, it } from 'vitest';
import { addDays } from '../../../src/domain/dates';
import { PROGRAM_A, PROGRAM_C } from '../../../src/domain/fixtures/templates';
import { missedDaysInMonth } from '../../../src/domain/missed-days';
import { lastRotationIndex, plannedDayTemplateId } from '../../../src/domain/schedule';
import { MissedDaySchema, type MissedDay } from '../../../src/domain/schemas';
import { todayPlan } from '../../../src/domain/today';
import { ANCHOR, activeProgram, makeSession } from './helpers';

const D = ANCHOR; // Monday of week 1

function missed(partial: Partial<MissedDay> & Pick<MissedDay, 'programId' | 'date'>): MissedDay {
  return {
    id: `missed-${partial.date}`,
    dayTemplateId: 'day',
    dayName: 'Heavy',
    rotationIndex: null,
    reason: null,
    note: '',
    createdAt: Date.parse(`${partial.date}T08:00:00`),
    ...partial,
  };
}

describe('missed day records', () => {
  it('accept a reason from the list, or none', () => {
    const base = missed({ programId: 'p', date: D });
    expect(MissedDaySchema.parse({ ...base, reason: 'sick' }).reason).toBe('sick');
    expect(MissedDaySchema.parse(base).reason).toBeNull();
    expect(() => MissedDaySchema.parse({ ...base, reason: 'lazy' })).toThrow();
  });
});

describe('a missed weekday', () => {
  it('shows as missed, with the next planned day, and the calendar does not move', () => {
    const { program, dayName } = activeProgram(PROGRAM_C);
    const heavy = plannedDayTemplateId(program, D);
    const record = missed({ programId: program.id, date: D, dayTemplateId: heavy ?? '' });
    const plan = todayPlan({ program, sessions: [], missedDays: [record], today: D });
    expect(plan.today).toEqual({ status: 'missed', missedDayId: record.id, dayTemplateId: heavy });
    expect(plan.next?.date).toBe(addDays(D, 2));
    expect(dayName(plan.next?.dayTemplateId ?? null)).toBe('Light (front lever first)');

    // Two days later the grid is where it always was.
    const later = todayPlan({ program, sessions: [], missedDays: [record], today: addDays(D, 2) });
    expect(later.today.status === 'planned' && dayName(later.today.day.dayTemplateId)).toBe(
      'Light (front lever first)',
    );
  });

  it('counts as done if the workout was done after all', () => {
    const { program } = activeProgram(PROGRAM_C);
    const heavy = plannedDayTemplateId(program, D);
    const record = missed({ programId: program.id, date: D, dayTemplateId: heavy ?? '' });
    const done = makeSession({ date: D, programId: program.id, dayTemplateId: heavy });
    const plan = todayPlan({ program, sessions: [done], missedDays: [record], today: D });
    expect(plan.today.status).toBe('done');
  });

  it("ignores another program's missed days", () => {
    const { program } = activeProgram(PROGRAM_C);
    const record = missed({ programId: 'other', date: D });
    const plan = todayPlan({ program, sessions: [], missedDays: [record], today: D });
    expect(plan.today.status).toBe('planned');
  });
});

describe('training another day of the program', () => {
  it('counts as today done, so Today stops asking', () => {
    const { program, dayTemplates } = activeProgram(PROGRAM_C);
    const planned = plannedDayTemplateId(program, D);
    const other = dayTemplates.find((d) => d.id !== planned);
    if (!other) throw new Error('no other day');
    const s = makeSession({ date: D, programId: program.id, dayTemplateId: other.id });
    const plan = todayPlan({ program, sessions: [s], today: D });
    expect(plan.today).toEqual({ status: 'done', sessionId: s.id, dayTemplateId: other.id });
  });
});

describe('a missed rotation day', () => {
  it('is skipped, so the rotation moves on to the day after it', () => {
    const { program, dayName } = activeProgram(PROGRAM_A);
    const s = makeSession({ date: D, programId: program.id, rotationIndex: 0 }); // Upper A
    const record = missed({ programId: program.id, date: addDays(D, 2), rotationIndex: 1 });
    const plan = todayPlan({ program, sessions: [s], missedDays: [record], today: addDays(D, 2) });
    expect(plan.today).toEqual({
      status: 'missed',
      missedDayId: record.id,
      dayTemplateId: record.dayTemplateId,
    });
    expect(dayName(plan.next?.dayTemplateId ?? null)).toBe('Upper B');

    const friday = todayPlan({
      program,
      sessions: [s],
      missedDays: [record],
      today: addDays(D, 4),
    });
    expect(friday.today.status === 'planned' && dayName(friday.today.day.dayTemplateId)).toBe(
      'Upper B',
    );
  });

  it('uses whichever came last, a session or a missed day', () => {
    const { program } = activeProgram(PROGRAM_A);
    const early = missed({ programId: program.id, date: D, rotationIndex: 0 });
    const s = makeSession({ date: addDays(D, 2), programId: program.id, rotationIndex: 1 });
    expect(lastRotationIndex([s], program.id, [early])).toBe(1);
    const late = missed({ programId: program.id, date: addDays(D, 4), rotationIndex: 2 });
    expect(lastRotationIndex([s], program.id, [early, late])).toBe(2);
    expect(lastRotationIndex([], program.id, [])).toBeNull();
  });
});

describe('missed days in a month', () => {
  it('counts planned weekdays with no workout, and how many were marked', () => {
    const { program } = activeProgram(PROGRAM_C, '2026-11-02');
    const days = (offsets: number[]) => offsets.map((o) => addDays('2026-11-02', o));
    const planned = days([0, 1, 2, 3, 4, 5, 6]).filter(
      (d) => plannedDayTemplateId(program, d) !== null,
    );
    expect(planned.length).toBeGreaterThan(2);
    const [first, second, third] = planned as [string, string, string];
    const sessions = [makeSession({ date: first, programId: program.id })];
    const marked = [missed({ programId: program.id, date: second })];

    // Today is the third planned day: it isn't missed yet, so it doesn't count.
    const result = missedDaysInMonth({
      program,
      sessions,
      missedDays: marked,
      month: '2026-11',
      today: third,
    });
    expect(result).toEqual({ total: 1, marked: 1 });
  });

  it('leaves out a marked day that is no longer planned', () => {
    const { program } = activeProgram(PROGRAM_C, '2026-11-02');
    const rest = addDays('2026-11-02', 1); // Tuesday is a rest day in Program C
    expect(plannedDayTemplateId(program, rest)).toBeNull();
    const result = missedDaysInMonth({
      program,
      sessions: [],
      missedDays: [missed({ programId: program.id, date: rest })],
      month: '2026-11',
      today: '2026-11-03',
    });
    expect(result.marked).toBeLessThanOrEqual(result.total);
    expect(result.marked).toBe(0);
  });

  it('starts counting at the first workout or missed day, not at an earlier anchor', () => {
    const { program } = activeProgram(PROGRAM_C, '2026-10-05');
    expect(
      missedDaysInMonth({
        program,
        sessions: [],
        missedDays: [],
        month: '2026-11',
        today: '2026-11-20',
      }),
    ).toEqual({ total: 0, marked: 0 });
  });

  it('counts only marked days for rotations, which have no fixed days', () => {
    const { program } = activeProgram(PROGRAM_A);
    const marked = [
      missed({ programId: program.id, date: '2026-11-04', rotationIndex: 1 }),
      missed({ programId: program.id, date: '2026-10-28', rotationIndex: 0 }),
    ];
    expect(
      missedDaysInMonth({
        program,
        sessions: [],
        missedDays: marked,
        month: '2026-11',
        today: '2026-11-20',
      }),
    ).toEqual({ total: 1, marked: 1 });
  });
});
