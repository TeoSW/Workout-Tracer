import { dateOfEpochMs, type DateStr } from '../domain/dates';
import { createDb, type WorkoutDb } from './db';

export type Clock = { now(): number; today(): DateStr };

/** Everything a repository needs. Tests swap in a fake database, a fixed clock and counter ids. */
export type DataContext = { db: WorkoutDb; clock: Clock; newId: () => string };

export const systemClock: Clock = {
  now: () => Date.now(),
  today: () => dateOfEpochMs(Date.now()),
};

export function createDefaultContext(): DataContext {
  return { db: createDb(), clock: systemClock, newId: () => crypto.randomUUID() };
}
