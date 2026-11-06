import { backupToJson, exportBackup, recordBackup } from '../../data/backup';
import type { DataContext } from '../../data/context';
import { backupFileName } from '../../domain/backup';
import { saveFile, type SaveResult } from '../../pwa/files';

/** Exports a full backup and notes the time, unless the user closed the share sheet. */
export async function saveBackup(ctx: DataContext): Promise<SaveResult> {
  const json = backupToJson(await exportBackup(ctx));
  const result = await saveFile(backupFileName(ctx.clock.today()), json, 'application/json');
  // The file is safe by now. Failing to note the time only brings the reminder back.
  if (result === 'saved') await recordBackup(ctx).catch(console.error);
  return result;
}
