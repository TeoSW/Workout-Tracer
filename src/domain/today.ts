import { addDays, type DateStr } from './dates';
import { isDeloadWeek } from './deload';
import {
  cyclePosition,
  lastRotationIndex,
  latestFinishedSession,
  latestMissedDay,
  nextRotationIndex,
  plannedDayTemplateId,
} from './schedule';
import type { MissedDay, Program, Session } from './schemas';

export type PlannedDay = {
  dayTemplateId: string;
  /** The calendar day for weekday grids. Null for rotations, which have no fixed days. */
  date: DateStr | null;
  rotationIndex: number | null;
};

export type TodayStatus =
  | { status: 'planned'; day: PlannedDay }
  | { status: 'rest' }
  | { status: 'missed'; missedDayId: string; dayTemplateId: string }
  | { status: 'done'; sessionId: string; dayTemplateId: string | null };

export type TodayPlan = {
  cycle: { cycleNumber: number; cycleWeek: number; cycleWeeks: number } | null;
  isDeloadWeek: boolean;
  today: TodayStatus;
  /** The next planned day after today. Set when today is done, missed or a rest day. */
  next: PlannedDay | null;
};

/**
 * What the Today tab shows for the active program. Missed days are skipped, never shifted: a
 * weekday grid keeps its calendar, and a rotation moves past the missed day.
 */
export function todayPlan(input: {
  program: Program;
  sessions: Session[];
  missedDays?: readonly MissedDay[];
  today: DateStr;
}): TodayPlan {
  const { program, sessions, today } = input;
  const missedDays = input.missedDays ?? [];
  const position = cyclePosition(program, today);
  const cycle =
    position === null || program.cycleWeeks === null
      ? null
      : {
          cycleNumber: position.cycleNumber,
          cycleWeek: position.cycleWeek,
          cycleWeeks: program.cycleWeeks,
        };
  const base = { cycle, isDeloadWeek: isDeloadWeek(program, today) };

  if (program.schedule.kind === 'rotation') {
    const latest = latestFinishedSession(sessions, program.id);
    const pointer = nextRotationIndex(program, lastRotationIndex(sessions, program.id, missedDays));
    const dayTemplateId = program.schedule.sequence[pointer];
    if (dayTemplateId === undefined) throw new Error(`No rotation entry at ${pointer}`);
    const day: PlannedDay = {
      dayTemplateId,
      date: null,
      rotationIndex: pointer,
    };
    const missed = latestMissedDay(missedDays, program.id);
    if (
      missed !== null &&
      missed.date === today &&
      (latest === null || missed.createdAt > latest.startedAt)
    ) {
      return {
        ...base,
        today: { status: 'missed', missedDayId: missed.id, dayTemplateId: missed.dayTemplateId },
        next: day,
      };
    }
    if (latest !== null && latest.date === today) {
      return {
        ...base,
        today: { status: 'done', sessionId: latest.id, dayTemplateId: latest.dayTemplateId },
        next: day,
      };
    }
    return { ...base, today: { status: 'planned', day }, next: null };
  }

  const plannedId = plannedDayTemplateId(program, today);
  const next = nextPlannedWeekday(program, today);
  if (plannedId === null) return { ...base, today: { status: 'rest' }, next };

  const done = sessions.find(
    (s) =>
      s.programId === program.id &&
      s.status === 'finished' &&
      s.date === today &&
      s.dayTemplateId === plannedId,
  );
  if (done) {
    return {
      ...base,
      today: { status: 'done', sessionId: done.id, dayTemplateId: plannedId },
      next,
    };
  }
  const missed = missedDays.find((m) => m.programId === program.id && m.date === today);
  if (missed) {
    return {
      ...base,
      today: { status: 'missed', missedDayId: missed.id, dayTemplateId: plannedId },
      next,
    };
  }
  return {
    ...base,
    today: {
      status: 'planned',
      day: { dayTemplateId: plannedId, date: today, rotationIndex: null },
    },
    next: null,
  };
}

function nextPlannedWeekday(program: Program, from: DateStr): PlannedDay | null {
  const horizon = (program.cycleWeeks ?? 1) * 7;
  for (let offset = 1; offset <= horizon; offset++) {
    const date = addDays(from, offset);
    const id = plannedDayTemplateId(program, date);
    if (id !== null) return { dayTemplateId: id, date, rotationIndex: null };
  }
  return null;
}
