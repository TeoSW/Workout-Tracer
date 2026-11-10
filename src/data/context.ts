import { APP_ID } from '../domain/config';
import { dateOfEpochMs, type DateStr } from '../domain/dates';
import type { Profile } from '../domain/schemas';
import { createDb, type WorkoutDb } from './db';

export type Clock = { now(): number; today(): DateStr };

/** Everything a repository needs. Tests swap in a fake database, a fixed clock and counter ids. */
export type DataContext = {
  db: WorkoutDb;
  clock: Clock;
  newId: () => string;
  /** Your own training, or the coach profile. Each has its own database. */
  profile: Profile;
};

/** The database each profile keeps its data in. Your own keeps the original name. */
export function databaseName(profile: Profile): string {
  return profile === 'coach' ? `${APP_ID}-coach` : APP_ID;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  today: () => dateOfEpochMs(Date.now()),
};

export function createDefaultContext(profile: Profile = 'me'): DataContext {
  return {
    db: createDb({ name: databaseName(profile) }),
    clock: systemClock,
    newId: () => crypto.randomUUID(),
    profile,
  };
}
