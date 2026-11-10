import { describe, expect, it } from 'vitest';
import { addBand, archiveBand, listBands, updateBand } from '../../../src/data/bands';
import { deleteBodyweight, listBodyweight, setBodyweight } from '../../../src/data/bodyweight';
import {
  addCustomExercise,
  archiveExercise,
  getExercise,
  listExercises,
  updateExercise,
} from '../../../src/data/exercises';
import { SEED_VERSION, seedIfNeeded } from '../../../src/data/seed';
import { getSettings, setSetting } from '../../../src/data/settings';
import { DEFAULT_SETTINGS } from '../../../src/domain/schemas';
import { testContext } from './helpers';

describe('seedIfNeeded', () => {
  it('writes bands and exercises on the first run only', async () => {
    const ctx = testContext();
    expect(await seedIfNeeded(ctx)).toBe(true);
    expect(await ctx.db.bands.count()).toBe(4);
    expect(await ctx.db.exercises.count()).toBe(60);
    expect((await ctx.db.settings.get('seedVersion'))?.value).toBe(SEED_VERSION);
    expect(await seedIfNeeded(ctx)).toBe(false);
    expect(await ctx.db.exercises.count()).toBe(60);
  });

  it('never overwrites or re-adds built-in exercises the user changed', async () => {
    const ctx = testContext();
    await seedIfNeeded(ctx);
    const squat = await getExercise(ctx, 'squat');
    if (!squat) throw new Error('missing squat');
    await updateExercise(ctx, { ...squat, cues: 'Knees out.' });
    await archiveExercise(ctx, 'plank');
    await ctx.db.exercises.delete('540');
    await seedIfNeeded(ctx);
    expect((await getExercise(ctx, 'squat'))?.cues).toBe('Knees out.');
    expect((await getExercise(ctx, 'plank'))?.archived).toBe(true);
    expect(await getExercise(ctx, '540')).toBeUndefined();
  });
  it('adds the version 2 exercises and the 5kg band to an install seeded at version 1', async () => {
    const ctx = testContext();
    await seedIfNeeded(ctx);
    await ctx.db.bands.delete('band-5');
    for (const id of ['push-ups', 'planche-press', 'dips']) await ctx.db.exercises.delete(id);
    await archiveExercise(ctx, 'plank');
    await ctx.db.settings.put({ key: 'seedVersion', value: 1 });

    expect(await seedIfNeeded(ctx)).toBe(true);
    expect(await ctx.db.bands.get('band-5')).toMatchObject({ ratedKg: 5 });
    expect((await getExercise(ctx, 'planche-press'))?.name).toBe('Planche Press');
    expect((await getExercise(ctx, 'plank'))?.archived).toBe(true);
    expect(await ctx.db.exercises.count()).toBe(60);
  });
});

describe('settings', () => {
  it('returns defaults, stores changes and validates them', async () => {
    const ctx = testContext();
    expect(await getSettings(ctx)).toEqual(DEFAULT_SETTINGS);
    await setSetting(ctx, 'effortMode', 'rpe');
    await setSetting(ctx, 'muscleReference', { min: 8, max: 16 });
    expect(await getSettings(ctx)).toEqual({
      ...DEFAULT_SETTINGS,
      effortMode: 'rpe',
      muscleReference: { min: 8, max: 16 },
    });
    await expect(setSetting(ctx, 'backupReminderDays', 0)).rejects.toThrow();
  });

  it('falls back to the default when a stored value is broken', async () => {
    const ctx = testContext();
    await ctx.db.settings.put({ key: 'sound', value: 'loud' });
    await ctx.db.settings.put({ key: 'seedVersion', value: 1 });
    expect(await getSettings(ctx)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('bands', () => {
  it('lists by rated kg, renames and archives without deleting', async () => {
    const ctx = testContext();
    await seedIfNeeded(ctx);
    const purple = await addBand(ctx, { label: 'Purple', ratedKg: 10, color: '#7a3cff' });
    expect((await listBands(ctx)).map((b) => b.ratedKg)).toEqual([5, 10, 15, 25, 35]);
    await updateBand(ctx, purple.id, { label: 'Thin purple' });
    await archiveBand(ctx, 'band-25');
    expect((await listBands(ctx)).map((b) => b.label)).toEqual([
      '5kg',
      'Thin purple',
      '15kg',
      '35kg',
    ]);
    expect(await listBands(ctx, { includeArchived: true })).toHaveLength(5);
    await expect(addBand(ctx, { label: '', ratedKg: 5 })).rejects.toThrow();
  });
});

describe('exercises', () => {
  it('adds custom exercises with fresh ids and lists active ones by name', async () => {
    const ctx = testContext();
    await seedIfNeeded(ctx);
    const ring = await addCustomExercise(ctx, {
      name: 'Ring Row',
      trackingType: 'bodyweight_reps',
      primaryMuscles: ['upper_back'],
      secondaryMuscles: ['biceps'],
      unilateral: false,
      loadUnit: 'total',
      defaultRestSec: 90,
      cues: '',
      alternativeIds: [],
    });
    expect(ring).toMatchObject({ id: 'id-1', isCustom: true, archived: false });
    await archiveExercise(ctx, 'plank');
    const names = (await listExercises(ctx)).map((e) => e.name);
    expect(names).toHaveLength(60);
    expect(names).toContain('Ring Row');
    expect(names).not.toContain('Plank');
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('rejects an exercise with a name another active exercise has', async () => {
    const ctx = testContext();
    await seedIfNeeded(ctx);
    const squat = await getExercise(ctx, 'squat');
    if (!squat) throw new Error('missing squat');
    const { id: _id, isCustom: _c, archived: _a, ...input } = squat;
    await expect(addCustomExercise(ctx, { ...input, name: 'squat ' })).rejects.toThrow(
      'An exercise with this name already exists.',
    );
  });
});

describe('bodyweight', () => {
  it('keeps one entry per day, last write wins', async () => {
    const ctx = testContext();
    await setBodyweight(ctx, '2026-11-02', 40);
    await setBodyweight(ctx, '2026-11-01', 39.5);
    await setBodyweight(ctx, '2026-11-02', 40.4);
    expect(await listBodyweight(ctx)).toEqual([
      { date: '2026-11-01', kg: 39.5 },
      { date: '2026-11-02', kg: 40.4 },
    ]);
    await deleteBodyweight(ctx, '2026-11-01');
    expect(await listBodyweight(ctx)).toHaveLength(1);
    await expect(setBodyweight(ctx, '2026-11-3', 40)).rejects.toThrow();
  });
});
