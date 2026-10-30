import type { BuiltInTemplate } from '../../../src/domain/fixtures/templates';
import type { DateStr } from '../../../src/domain/dates';
import type { DayTemplate, LoggedSet, Program, Session } from '../../../src/domain/schemas';
import { instantiateTemplate } from '../../../src/domain/templates';

/** Deterministic id generator for tests. */
export function counterIds(prefix = 'id'): () => string {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

/** A Monday used as the anchor in schedule tests. */
export const ANCHOR: DateStr = '2026-11-02';

export function activeProgram(
  template: BuiltInTemplate,
  anchorDate: DateStr | null = ANCHOR,
): { program: Program; dayTemplates: DayTemplate[]; dayName: (id: string | null) => string } {
  const { program, dayTemplates } = instantiateTemplate(template, { newId: counterIds('t') });
  const names = new Map(dayTemplates.map((d) => [d.id, d.name]));
  return {
    program: { ...program, anchorDate, active: true },
    dayTemplates,
    dayName: (id) => (id === null ? 'rest' : (names.get(id) ?? `unknown ${id}`)),
  };
}

export function dayByName(dayTemplates: DayTemplate[], name: string): DayTemplate {
  const found = dayTemplates.find((d) => d.name === name);
  if (!found) throw new Error(`No day ${name}`);
  return found;
}

let sessionCounter = 0;

export function makeSession(partial: Partial<Session> & { date: DateStr }): Session {
  sessionCounter += 1;
  const startedAt = Date.parse(`${partial.date}T10:00:00`);
  return {
    id: `sess-${sessionCounter}`,
    programId: null,
    dayTemplateId: null,
    cycleNumber: null,
    cycleWeek: null,
    rotationIndex: null,
    name: 'Session',
    dayType: 'hypertrophy',
    isDeload: false,
    startedAt,
    finishedAt: startedAt + 3_600_000,
    status: 'finished',
    notes: '',
    planSnapshot: null,
    ...partial,
  };
}

let setCounter = 0;

export function makeSet(
  partial: Partial<LoggedSet> & Pick<LoggedSet, 'sessionId' | 'exerciseId'>,
): LoggedSet {
  setCounter += 1;
  return {
    id: `set-${setCounter}`,
    sessionExerciseId: `${partial.sessionId}-${partial.exerciseId}`,
    order: setCounter,
    kind: 'working',
    rir: null,
    done: true,
    completedAt: 0,
    ...partial,
  };
}
