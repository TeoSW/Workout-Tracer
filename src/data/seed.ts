import { SEED_BANDS } from '../domain/fixtures/bands';
import { SEED_EXERCISES } from '../domain/fixtures/exercises';
import { clean } from './clean';
import type { DataContext } from './context';

/**
 * Bump when a release adds built-in exercises or bands, and list the new ids in
 * INTRODUCED_IN with the version that adds them. Ids not listed count as version 1.
 */
export const SEED_VERSION = 2;
const INTRODUCED_IN: Readonly<Record<string, number>> = {
  'band-5': 2,
  'push-ups': 2,
  'inverted-row': 2,
  dips: 2,
  'pike-push-ups': 2,
  'planche-press': 2,
  'oblique-extension': 2,
};

const SEED_VERSION_KEY = 'seedVersion';

/**
 * Writes the built-in bands and exercises the stored seed version has not seen yet. Records that
 * already exist are left alone, so edits and archives survive, and anything seeded once is never
 * added again even if the user deleted it. Returns true when something was seeded.
 */
export async function seedIfNeeded(ctx: DataContext): Promise<boolean> {
  const { db } = ctx;
  return db.transaction('rw', [db.exercises, db.bands, db.settings], async () => {
    const stored = (await db.settings.get(SEED_VERSION_KEY))?.value;
    const from = typeof stored === 'number' ? stored : 0;
    if (from >= SEED_VERSION) return false;

    const isNew = (id: string) => (INTRODUCED_IN[id] ?? 1) > from;
    const bands = SEED_BANDS.filter((b) => isNew(b.id));
    const exercises = SEED_EXERCISES.filter((e) => isNew(e.id));
    const existingBands = new Set(await db.bands.bulkGet(bands.map((b) => b.id)).then(ids));
    const existingExercises = new Set(
      await db.exercises.bulkGet(exercises.map((e) => e.id)).then(ids),
    );
    // A custom exercise the user already made under the same name stays the only one.
    const names = new Set((await db.exercises.toArray()).map((e) => e.name.toLowerCase()));
    for (const e of exercises) {
      if (!existingExercises.has(e.id) && names.has(e.name.toLowerCase())) {
        existingExercises.add(e.id);
      }
    }
    await db.bands.bulkPut(clean(bands.filter((b) => !existingBands.has(b.id))));
    await db.exercises.bulkPut(clean(exercises.filter((e) => !existingExercises.has(e.id))));
    await db.settings.put({ key: SEED_VERSION_KEY, value: SEED_VERSION });
    return true;
  });
}

function ids(rows: readonly ({ id: string } | undefined)[]): string[] {
  return rows.flatMap((r) => (r ? [r.id] : []));
}
