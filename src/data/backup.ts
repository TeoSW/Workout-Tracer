import { createBackup, type BackupData, type BackupFile } from '../domain/backup';
import { clean } from './clean';
import type { DataContext } from './context';
import { BACKUP_TABLES } from './db';
import { setSetting } from './settings';

const SNAPSHOT_ID = 'pre-restore';

async function readAll(ctx: DataContext): Promise<BackupData> {
  const { db } = ctx;
  return db.transaction(
    'r',
    BACKUP_TABLES.map((t) => db.table(t)),
    async () => {
      const entries = await Promise.all(
        BACKUP_TABLES.map(async (t) => [t, await db.table(t).toArray()] as const),
      );
      return Object.fromEntries(entries) as BackupData;
    },
  );
}

async function writeAll(ctx: DataContext, data: BackupData): Promise<void> {
  for (const t of BACKUP_TABLES) {
    await ctx.db.table(t).clear();
    // bulkAdd, not bulkPut: a file with duplicate ids is broken and must fail the restore.
    await ctx.db.table(t).bulkAdd(clean(data[t]));
  }
}

/** Every table except the restore snapshot, ready to save as a file. */
export async function exportBackup(ctx: DataContext): Promise<BackupFile> {
  return createBackup(await readAll(ctx), ctx.clock.now());
}

export function backupToJson(backup: BackupFile): string {
  return JSON.stringify(backup);
}

/** Call once the file was shared or downloaded, so the backup reminder resets. */
export async function recordBackup(ctx: DataContext): Promise<void> {
  await setSetting(ctx, 'lastBackupAt', ctx.clock.now());
}

/**
 * Replaces all data with a validated backup. The current data is kept as a snapshot first, so
 * the restore can be undone. Runs in one transaction: if any write fails, nothing changes.
 */
export async function restoreBackup(ctx: DataContext, backup: BackupFile): Promise<void> {
  const { db } = ctx;
  await db.transaction('rw', db.tables, async () => {
    const current = createBackup(await readAll(ctx), ctx.clock.now());
    await writeAll(ctx, backup.data);
    await db.snapshots.put({ id: SNAPSHOT_ID, createdAt: ctx.clock.now(), backup: current });
  });
}

export async function hasUndoSnapshot(ctx: DataContext): Promise<{ createdAt: number } | null> {
  const snapshot = await ctx.db.snapshots.get(SNAPSHOT_ID);
  return snapshot ? { createdAt: snapshot.createdAt } : null;
}

/** Puts back the data from before the last restore. */
export async function undoLastRestore(ctx: DataContext): Promise<void> {
  const { db } = ctx;
  await db.transaction('rw', db.tables, async () => {
    const snapshot = await db.snapshots.get(SNAPSHOT_ID);
    if (!snapshot) throw new Error('There is no restore to undo.');
    await writeAll(ctx, snapshot.backup.data);
    await db.snapshots.delete(SNAPSHOT_ID);
  });
}
