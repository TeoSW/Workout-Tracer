import { Dexie } from 'dexie';
import { IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { exportBackup, restoreBackup, undoLastRestore } from '../../../src/data/backup';
import type { DataContext } from '../../../src/data/context';
import { createDb } from '../../../src/data/db';
import { listMissedDays, markDayMissed, undoMissedDay } from '../../../src/data/missed-days';
import { activateProgram, createProgramFromTemplate } from '../../../src/data/programs';
import { seedIfNeeded } from '../../../src/data/seed';
import { getTodayOverview } from '../../../src/data/today';
import { emptyBackupData, parseBackup } from '../../../src/domain/backup';
import { APP_ID } from '../../../src/domain/config';
import { PROGRAM_A, PROGRAM_C } from '../../../src/domain/fixtures/templates';
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
