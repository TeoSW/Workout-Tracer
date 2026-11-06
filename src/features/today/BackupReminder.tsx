import { IonItem, IonLabel, IonList } from '@ionic/react';
import { useData, useLive } from '../../app/DataProvider';
import { firstFinishedDate } from '../../data/history';
import { getSettings } from '../../data/settings';
import { backupDue } from '../../domain/backup';
import { dateOfEpochMs, type DateStr } from '../../domain/dates';
import { formatDateWithYear } from '../../domain/format';
import { ErrorNote, useGuard } from '../../ui/useGuard';
import { saveBackup } from '../settings/saveBackup';

export function BackupReminder({ today }: { today: DateStr }) {
  const ctx = useData();
  const state = useLive(async (c) => ({
    settings: await getSettings(c),
    firstFinished: await firstFinishedDate(c),
  }));
  const { error, guard } = useGuard();
  if (!state) return null;

  const { lastBackupAt, backupReminderDays } = state.settings;
  const due = backupDue({
    lastBackupAt,
    reminderDays: backupReminderDays,
    firstFinishedDate: state.firstFinished,
    today,
  });
  if (!due) return null;

  const last =
    lastBackupAt === null
      ? 'You have no backup yet.'
      : `Your last backup was on ${formatDateWithYear(dateOfEpochMs(lastBackupAt))}.`;

  return (
    <>
      <IonList inset>
        <IonItem>
          <IonLabel className="ion-text-wrap">
            <h2>Back up your data</h2>
            <p>{`${last} iOS can clear app data, so keep a copy in Files.`}</p>
          </IonLabel>
        </IonItem>
        <IonItem button detail={false} onClick={() => void guard(() => saveBackup(ctx))}>
          <IonLabel color="primary">Export backup</IonLabel>
        </IonItem>
      </IonList>
      <ErrorNote error={error} />
    </>
  );
}
