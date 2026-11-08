import { IonItem, IonLabel, IonList, IonListHeader, IonNote } from '@ionic/react';
import { useRef, useState, type ChangeEvent } from 'react';
import { useData, useLive } from '../../app/DataProvider';
import { hasUndoSnapshot, restoreBackup, undoLastRestore } from '../../data/backup';
import { exportCsv } from '../../data/csv';
import { parseBackup, recordCounts, type BackupFile } from '../../domain/backup';
import { dateOfEpochMs } from '../../domain/dates';
import type { AppSettings } from '../../domain/schemas';
import { readFileText, saveFile } from '../../pwa/files';
import { saveBackup } from './saveBackup';

function parseFile(text: string): ReturnType<typeof parseBackup> {
  try {
    return parseBackup(JSON.parse(text));
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
}

export function BackupSection({ settings }: { settings: AppSettings }) {
  const ctx = useData();
  const undo = useLive(hasUndoSnapshot);
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const say = (text: string, error = false) => setMessage({ text, error });

  async function run(action: () => Promise<void>) {
    try {
      await action();
    } catch (error) {
      say(error instanceof Error ? error.message : 'Something went wrong.', true);
    }
  }

  const exportJson = () =>
    run(async () => {
      if ((await saveBackup(ctx)) === 'saved') say('Backup saved.');
    });

  const exportSheet = () =>
    run(async () => {
      const name = `workout-tracker-sets-${ctx.clock.today()}.csv`;
      if ((await saveFile(name, await exportCsv(ctx), 'text/csv')) === 'saved') say('CSV saved.');
    });

  const pickFile = (event: ChangeEvent<HTMLInputElement>) =>
    run(async () => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      const parsed = parseFile(await readFileText(file));
      setPending(parsed.ok ? parsed.backup : null);
      if (parsed.ok) setMessage(null);
      else say(parsed.error, true);
    });

  const replaceAll = () =>
    run(async () => {
      if (!pending || restoring) return;
      // A long history can take a while, and a second tap must not start it again.
      setRestoring(true);
      say('Restoring. Keep the app open until it finishes.');
      try {
        await restoreBackup(ctx, pending);
      } finally {
        setRestoring(false);
      }
      setPending(null);
      say('Backup restored.');
    });

  const undoRestore = () =>
    run(async () => {
      await undoLastRestore(ctx);
      say('Restore undone.');
    });

  const counts = pending ? recordCounts(pending) : null;

  return (
    <>
      <IonList inset>
        <IonListHeader>
          <IonLabel>Backup</IonLabel>
        </IonListHeader>
        <IonItem button detail={false} onClick={() => void exportJson()}>
          <IonLabel color="primary">Export backup</IonLabel>
          <IonNote slot="end">
            {settings.lastBackupAt === null ? 'Never' : dateOfEpochMs(settings.lastBackupAt)}
          </IonNote>
        </IonItem>
        <IonItem button detail={false} onClick={() => fileInput.current?.click()}>
          <IonLabel color="primary">Restore from file</IonLabel>
        </IonItem>
        <IonItem button detail={false} onClick={() => void exportSheet()}>
          <IonLabel color="primary">Export CSV</IonLabel>
        </IonItem>
        {counts && (
          <>
            <IonItem>
              <IonLabel className="ion-text-wrap">
                {`${counts.exercises} exercises, ${counts.sessions} sessions, ${counts.bodyweight} bodyweight entries`}
              </IonLabel>
            </IonItem>
            <IonItem button detail={false} disabled={restoring} onClick={() => void replaceAll()}>
              <IonLabel color="danger">Replace all data</IonLabel>
            </IonItem>
          </>
        )}
        {undo && (
          <IonItem button detail={false} onClick={() => void undoRestore()}>
            <IonLabel color="primary">Undo last restore</IonLabel>
          </IonItem>
        )}
      </IonList>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        aria-label="Backup file"
        hidden
        onChange={(e) => void pickFile(e)}
      />
      {message && (
        <p className={message.error ? 'error-note' : 'section-note'} role="status">
          {message.text}
        </p>
      )}
    </>
  );
}
