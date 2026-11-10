import { Dexie } from 'dexie';
import { IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { exportBackup, restoreBackup, undoLastRestore } from '../../../src/data/backup';
import {
  addClient,
  archiveClient,
  getClient,
  listClients,
  updateClient,
} from '../../../src/data/clients';
import { databaseName } from '../../../src/data/context';
import { createDb } from '../../../src/data/db';
import {
  createProgramFromTemplate,
  editProgram,
  markProgramSent,
  sentStatus,
} from '../../../src/data/programs';
import { seedIfNeeded } from '../../../src/data/seed';
import { shareProgram } from '../../../src/data/share';
import { backupFileName, emptyBackupData, parseBackup } from '../../../src/domain/backup';
import { APP_ID } from '../../../src/domain/config';
import { CALISTHENICS_5_WEEK } from '../../../src/domain/fixtures/templates';
import { testContext } from './helpers';

describe('clients', () => {
  it('are added, renamed, listed by name and archived without losing programs', async () => {
    const ctx = testContext({ profile: 'coach' });
    await seedIfNeeded(ctx);
    const ana = await addClient(ctx, { name: ' Ana ', note: 'Wrist pain on dips' });
    await addClient(ctx, { name: 'Bogdan', note: '' });
    expect((await listClients(ctx)).map((c) => c.name)).toEqual(['Ana', 'Bogdan']);
    await expect(addClient(ctx, { name: '  ', note: '' })).rejects.toThrow(
      'Give the client a name.',
    );

    await updateClient(ctx, ana.id, { name: 'Ana P.' });
    const { program } = await createProgramFromTemplate(ctx, CALISTHENICS_5_WEEK, undefined, {
      clientId: ana.id,
    });
    expect(program.clientId).toBe(ana.id);
    expect((await getClient(ctx, ana.id))?.programs.map((p) => p.id)).toEqual([program.id]);

    await archiveClient(ctx, ana.id);
    expect((await listClients(ctx)).map((c) => c.name)).toEqual(['Bogdan']);
    expect((await getClient(ctx, ana.id))?.programs).toHaveLength(1);
  });
});

describe('sending a program', () => {
  it('records when it was sent, and notices a change since', async () => {
    const ctx = testContext({ profile: 'coach' });
    await seedIfNeeded(ctx);
    const ana = await addClient(ctx, { name: 'Ana', note: '' });
    const { program } = await createProgramFromTemplate(ctx, CALISTHENICS_5_WEEK, undefined, {
      clientId: ana.id,
    });
    const first = await shareProgram(ctx, program.id);
    expect(sentStatus(program, first.code)).toBe('not_sent');

    const sent = await markProgramSent(ctx, program.id, first.code);
    expect(sent.sentAt).toBe(ctx.clock.now());
    expect(sentStatus(sent, (await shareProgram(ctx, program.id)).code)).toBe('sent');

    const edited = await editProgram(ctx, program.id, (p) => ({ ...p, note: 'New note' }));
    expect(sentStatus(edited, (await shareProgram(ctx, program.id)).code)).toBe('changed');
  });

  it('never puts the client or the sent record into the shared program', async () => {
    const ctx = testContext({ profile: 'coach' });
    await seedIfNeeded(ctx);
    const ana = await addClient(ctx, { name: 'Ana', note: '' });
    const { program } = await createProgramFromTemplate(ctx, CALISTHENICS_5_WEEK, undefined, {
      clientId: ana.id,
    });
    await markProgramSent(ctx, program.id, 'old');
    const { share } = await shareProgram(ctx, program.id);
    expect(share.program).not.toHaveProperty('clientId');
    expect(share.program).not.toHaveProperty('sentCode');
    expect(JSON.stringify(share)).not.toContain('sentAt');
  });
});

describe('profiles and backups', () => {
  it('keep each profile in its own database', () => {
    expect(databaseName('me')).toBe(APP_ID);
    expect(databaseName('coach')).toBe(`${APP_ID}-coach`);
  });

  it('name and mark a coach backup, and refuse it in the other profile', async () => {
    const coach = testContext({ profile: 'coach' });
    await seedIfNeeded(coach);
    await addClient(coach, { name: 'Ana', note: '' });
    const backup = await exportBackup(coach);
    expect(backup.profile).toBe('coach');
    expect(backup.data.clients).toHaveLength(1);
    expect(backupFileName('2026-11-10', 'coach')).toBe(
      'workout-tracker-coach-backup-2026-11-10.json',
    );

    const me = testContext();
    await seedIfNeeded(me);
    await expect(restoreBackup(me, backup)).rejects.toThrow(
      'This is a coach backup. Switch to the coach profile in Settings to restore it.',
    );
    await expect(restoreBackup(coach, await exportBackup(me))).rejects.toThrow(
      'This backup is from your own training.',
    );
    const otherCoach = testContext({ profile: 'coach' });
    await restoreBackup(otherCoach, backup);
    expect((await listClients(otherCoach)).map((c) => c.name)).toEqual(['Ana']);
  });

  it('read an older backup as your own training, with no clients', () => {
    const { clients: _c, ...v2Data } = emptyBackupData();
    const parsed = parseBackup({ app: APP_ID, schemaVersion: 2, exportedAt: 1, data: v2Data });
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.backup).toMatchObject({ schemaVersion: 3, profile: 'me' });
    expect(parsed.backup.data.clients).toEqual([]);
  });

  it('upgrade a version 2 database and its Undo restore copy', async () => {
    const ctx = testContext();
    const { clients: _c, ...v2Data } = emptyBackupData();
    const old = new Dexie(APP_ID, { indexedDB: ctx.factory, IDBKeyRange });
    const v1 = {
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
    };
    old.version(1).stores(v1);
    old.version(2).stores({ ...v1, missedDays: 'id, programId, date' });
    await old.table('bodyweight').put({ date: '2026-11-01', kg: 70 });
    await old.table('snapshots').put({
      id: 'pre-restore',
      createdAt: 1,
      backup: { app: APP_ID, schemaVersion: 2, exportedAt: 1, data: v2Data },
    });
    old.close();

    const upgraded = { ...ctx, db: createDb({ indexedDB: ctx.factory, IDBKeyRange }) };
    expect(await upgraded.db.clients.count()).toBe(0);
    const snapshot = await upgraded.db.snapshots.get('pre-restore');
    expect(snapshot?.backup).toMatchObject({ schemaVersion: 3, data: { clients: [] } });
    await undoLastRestore(upgraded);
    expect(await upgraded.db.bodyweight.count()).toBe(0);
  });
});
