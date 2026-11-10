import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import type { DataContext } from '../../../src/data/context';
import { createDb } from '../../../src/data/db';
import { dateOfEpochMs } from '../../../src/domain/dates';
import type { Profile } from '../../../src/domain/schemas';

type Factory = InstanceType<typeof IDBFactory>;

export const START_MS = Date.parse('2026-11-02T10:00:00');

export type TestClock = {
  now(): number;
  today(): string;
  advance(ms: number): void;
  set(ms: number): void;
};

export function testClock(startMs = START_MS): TestClock {
  let current = startMs;
  return {
    now: () => current,
    today: () => dateOfEpochMs(current),
    advance: (ms) => {
      current += ms;
    },
    set: (ms) => {
      current = ms;
    },
  };
}

/** A data context on a fresh in-memory IndexedDB, a fixed clock and counter ids. */
export function testContext(
  opts: { factory?: Factory; clock?: TestClock; idPrefix?: string; profile?: Profile } = {},
): DataContext & { clock: TestClock; factory: Factory } {
  const factory = opts.factory ?? new IDBFactory();
  const clock = opts.clock ?? testClock();
  let n = 0;
  const prefix = opts.idPrefix ?? 'id';
  return {
    db: createDb({ indexedDB: factory, IDBKeyRange }),
    clock,
    factory,
    newId: () => `${prefix}-${++n}`,
    profile: opts.profile ?? 'me',
  };
}

/** Opens the same database again, as a reload of the app would. */
export function reopen(ctx: ReturnType<typeof testContext>): ReturnType<typeof testContext> {
  ctx.db.close();
  return { ...ctx, db: createDb({ indexedDB: ctx.factory, IDBKeyRange }) };
}
