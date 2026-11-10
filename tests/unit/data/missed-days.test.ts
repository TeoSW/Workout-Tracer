import { Dexie } from 'dexie';
import { IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { exportBackup, restoreBackup, undoLastRestore } from '../../../src/data/backup';
import type { DataContext } from '../../../src/data/context';
import { createDb } from '../../../src/data/db';
import { listMissedDays, markDayMissed, undoMissedDay } from '../../../src/data/missed-days';
import { addCustomExercise } from '../../../src/data/exercises';
import {
  activateProgram,
  createProgramFromTemplate,
  getProgram,
  updateProgram,
} from '../../../src/data/programs';
import { seedIfNeeded } from '../../../src/data/seed';
import { finishSession, startPlannedSession } from '../../../src/data/sessions';
import { getTodayOverview } from '../../../src/data/today';
import { emptyBackupData, parseBackup } from '../../../src/domain/backup';
import { APP_ID } from '../../../src/domain/config';
import {
  BEGINNER_CALISTHENICS,
  PROGRAM_A,
  PROGRAM_C,
} from '../../../src/domain/fixtures/templates';
import { testContext } from './helpers';

// The test clock starts on Monday 2026-11-02.
async function withProgram(ctx: DataContext, template = PROGRAM_C) {
  await seedIfNeeded(ctx);
  const { program } = await createProgramFromTemplate(ctx, template);
  await activateProgram(ctx, program.id, 'this_week');
  return program;
}

describe('marking a day missed', () => {
  it('records the planned day with the reason, and Today moves on', async () => {
    const ctx = testContext();
    await withProgram(ctx);
    const before = await getTodayOverview(ctx);
    if (before.plan?.today.status !== 'planned') throw new Error('expected a planned day');

    const record = await markDayMissed(ctx, { reason: 'sick', note: 'Fever' });
    expect(record).toMatchObject({
      date: '2026-11-02',
      dayTemplateId: before.plan.today.day.dayTemplateId,
      rotationIndex: null,
      reason: 'sick',
      note: 'Fever',
      createdAt: ctx.clock.now(),
    });
    const after = await getTodayOverview(ctx);
    expect(after.plan?.today).toMatchObject({ status: 'missed', missedDayId: record.id });
    expect(after.plan?.next).not.toBeNull();
    expect(await listMissedDays(ctx)).toEqual([record]);
  });

  it('stores the rotation position, so a rotation skips the day', async () => {
    const ctx = testContext();
    await withProgram(ctx, PROGRAM_A);
    const record = await markDayMissed(ctx, { reason: null, note: '' });
    expect(record.rotationIndex).toBe(0);
    const after = await getTodayOverview(ctx);
    expect(after.plan?.next?.rotationIndex).toBe(1);
  });

  it('refuses when nothing is planned today', async () => {
    const ctx = testContext();
    await seedIfNeeded(ctx);
    await expect(markDayMissed(ctx, { reason: null, note: '' })).rejects.toThrow(
      'Nothing is planned today.',
    );
  });

  it('can be undone', async () => {
    const ctx = testContext();
    await withProgram(ctx);
    const record = await markDayMissed(ctx, { reason: 'busy', note: '' });
    await undoMissedDay(ctx, record.id);
    expect(await listMissedDays(ctx)).toEqual([]);
    expect((await getTodayOverview(ctx)).plan?.today.status).toBe('planned');
  });
});

describe('review fixes', () => {
  it('records a day once, even when Skip day is tapped twice', async () => {
    const ctx = testContext();
    await withProgram(ctx);
    const results = await Promise.allSettled([
      markDayMissed(ctx, { reason: null, note: '' }),
      markDayMissed(ctx, { reason: null, note: '' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(await listMissedDays(ctx)).toHaveLength(1);
  });

  it('counts a missed rotation day when a repeated day is started by hand', async () => {
    const ctx = testContext();
    const program = await withProgram(ctx, PROGRAM_A);
    const loaded = await getProgram(ctx, program.id);
    const [upperA, lowerA, upperB] =
      loaded?.program.schedule.kind === 'rotation' ? loaded.program.schedule.sequence : [];
    if (!upperA || !lowerA || !upperB || !loaded) throw new Error('unexpected rotation');
    // [Upper A, Lower A, Upper B, Lower A]: Lower A appears twice.
    await updateProgram(ctx, {
      ...loaded.program,
      schedule: {
        kind: 'rotation',
        sequence: [upperA, lowerA, upperB, lowerA],
        sessionsPerWeek: 3,
      },
    });
    const first = await startPlannedSession(ctx, { programId: program.id, dayTemplateId: upperA });
    await finishSession(ctx, first.session.id);
    ctx.clock.advance(86_400_000);
    await markDayMissed(ctx, { reason: null, note: '' }); // skips Lower A at 1
    ctx.clock.advance(60_000);
    const byHand = await startPlannedSession(ctx, { programId: program.id, dayTemplateId: lowerA });
    expect(byHand.session.rotationIndex).toBe(3);
  });

  it('lets a preset use a custom exercise that already had the built-in name', async () => {
    const ctx = testContext();
    await seedIfNeeded(ctx);
    await ctx.db.exercises.delete('push-ups');
    await ctx.db.settings.put({ key: 'seedVersion', value: 1 });
    const mine = await addCustomExercise(ctx, {
      name: 'Push-ups',
      trackingType: 'bodyweight_reps',
      primaryMuscles: ['chest'],
      secondaryMuscles: [],
      unilateral: false,
      loadUnit: 'total',
      defaultRestSec: 90,
      cues: '',
      alternativeIds: [],
    });
    await seedIfNeeded(ctx);
    expect(await ctx.db.exercises.get('push-ups')).toBeUndefined();
    const { dayTemplates } = await createProgramFromTemplate(ctx, BEGINNER_CALISTHENICS);
    const ids = dayTemplates.flatMap((d) =>
      d.blocks.map((b) => (b.kind === 'exercise' ? b.exerciseId : '')),
    );
    expect(ids).toContain(mine.id);
    expect(ids).not.toContain('push-ups');
  });

  it('adds the newer built-ins after restoring a backup from an older release', async () => {
    const old = testContext();
    await seedIfNeeded(old);
    await old.db.bands.delete('band-5');
    await old.db.exercises.delete('planche-press');
    await old.db.settings.put({ key: 'seedVersion', value: 1 });
    const backup = await exportBackup(old);

    const ctx = testContext();
    await restoreBackup(ctx, backup);
    expect(await ctx.db.bands.get('band-5')).toBeDefined();
    expect(await ctx.db.exercises.get('planche-press')).toBeDefined();
  });
});

describe('backup version 2', () => {
  it('backs up missed days and restores them', async () => {
    const ctx = testContext();
    await withProgram(ctx);
    await markDayMissed(ctx, { reason: 'travel', note: '' });
    const backup = await exportBackup(ctx);
    expect(backup.schemaVersion).toBe(2);
    expect(backup.data.missedDays).toHaveLength(1);

    const fresh = testContext();
    await restoreBackup(fresh, backup);
    expect(await listMissedDays(fresh)).toEqual(backup.data.missedDays);
  });

  it('still reads version 1 backups, with no missed days', () => {
    const { missedDays: _, ...v1Data } = emptyBackupData();
    const parsed = parseBackup({ app: APP_ID, schemaVersion: 1, exportedAt: 1, data: v1Data });
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.backup.schemaVersion).toBe(2);
    expect(parsed.backup.data.missedDays).toEqual([]);
  });

  it('upgrades a version 1 database, including the copy kept for Undo restore', async () => {
    const ctx = testContext();
    const { missedDays: _, ...v1Data } = emptyBackupData();
    const old = new Dexie(APP_ID, { indexedDB: ctx.factory, IDBKeyRange });
    old.version(1).stores({
      exercises: 'id, name',
      bands: 'id',
      programs: 'id',
      dayTemplates: 'id, programId',
      sessions: 'id, programId, date, status',
      sessionExercises: 'id, sessionId',
      sets: 'id, sessionId, sessionExerciseId, exerciseId',
      bodyweight: 'date',
      testResults: 'id, sessionId, exerciseId',
      settings: 'key',
      restTimer: 'id',
      snapshots: 'id',
    });
    await old.table('bodyweight').put({ date: '2026-11-01', kg: 70 });
    await old.table('snapshots').put({
      id: 'pre-restore',
      createdAt: 1,
      backup: { app: APP_ID, schemaVersion: 1, exportedAt: 1, data: v1Data },
    });
    old.close();

    const upgraded = { ...ctx, db: createDb({ indexedDB: ctx.factory, IDBKeyRange }) };
    expect(await upgraded.db.bodyweight.count()).toBe(1);
    expect(await upgraded.db.missedDays.count()).toBe(0);
    const snapshot = await upgraded.db.snapshots.get('pre-restore');
    expect(snapshot?.backup).toMatchObject({ schemaVersion: 2, data: { missedDays: [] } });
    await undoLastRestore(upgraded);
    expect(await upgraded.db.bodyweight.count()).toBe(0);
  });
});
