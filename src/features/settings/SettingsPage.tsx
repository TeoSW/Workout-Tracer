import {
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonToggle,
  useIonViewWillEnter,
} from '@ionic/react';
import { useState } from 'react';
import { version } from '../../../package.json';
import { useData, useLive } from '../../app/DataProvider';
import { getSettings, setSetting } from '../../data/settings';
import type { EffortMode } from '../../domain/schemas';
import { playRestTone, unlockAudio } from '../../pwa/audio';
import { getStorageStatus, type StorageStatus } from '../../pwa/storage';
import { PageShell } from '../../ui/PageShell';
import { Stepper } from '../../ui/Stepper';
import { BackupSection } from './BackupSection';
import { ProfileSection } from './ProfileSection';

const MB = 1_000_000;

function storageText(status: StorageStatus | null): string {
  if (status?.persisted === true) return 'Persistent';
  if (status?.persisted === false) return 'Not persistent';
  return 'Unknown';
}

function usageText(status: StorageStatus | null): string {
  if (status?.usage === null || status?.usage === undefined) return 'Unknown';
  const used = `${(status.usage / MB).toFixed(1)} MB`;
  return status.quota === null ? used : `${used} of ${Math.round(status.quota / MB)} MB`;
}

export function SettingsPage() {
  const ctx = useData();
  const settings = useLive(getSettings);
  const [storage, setStorage] = useState<StorageStatus | null>(null);

  useIonViewWillEnter(() => {
    void getStorageStatus().then(setStorage);
  });

  return (
    <PageShell title="Settings">
      <ProfileSection />
      {settings && (
        <>
          {ctx.profile === 'coach' ? (
            <IonList inset>
              <IonItem routerLink="/tabs/settings/bands" detail>
                <IonLabel>Bands</IonLabel>
              </IonItem>
            </IonList>
          ) : (
            <IonList inset>
              <IonListHeader>
                <IonLabel>Logging</IonLabel>
              </IonListHeader>
              <IonItem>
                <IonSelect
                  aria-label="Effort input"
                  label="Effort input"
                  interface="action-sheet"
                  value={settings.effortMode}
                  onIonChange={(e) =>
                    void setSetting(ctx, 'effortMode', e.detail.value as EffortMode)
                  }
                >
                  <IonSelectOption value="rir">RIR</IonSelectOption>
                  <IonSelectOption value="rpe">RPE</IonSelectOption>
                  <IonSelectOption value="off">Off</IonSelectOption>
                </IonSelect>
              </IonItem>
              <IonItem>
                <IonToggle
                  aria-label="Sound"
                  checked={settings.sound}
                  onIonChange={(e) => void setSetting(ctx, 'sound', e.detail.checked)}
                >
                  Sound
                </IonToggle>
              </IonItem>
              <IonItem
                button
                detail={false}
                onClick={() => {
                  unlockAudio();
                  // The tap starts the sound; the alarm itself plays just after.
                  setTimeout(() => playRestTone(), 50);
                }}
              >
                <IonLabel color="primary">Play test alarm</IonLabel>
              </IonItem>
              <IonItem>
                <IonToggle
                  aria-label="Keep screen awake"
                  checked={settings.keepAwake}
                  onIonChange={(e) => void setSetting(ctx, 'keepAwake', e.detail.checked)}
                >
                  Keep screen awake
                </IonToggle>
              </IonItem>
              <IonItem routerLink="/tabs/settings/bands" detail>
                <IonLabel>Bands</IonLabel>
              </IonItem>
            </IonList>
          )}

          <BackupSection settings={settings} />

          {ctx.profile !== 'coach' && (
            <IonList inset>
              <IonListHeader>
                <IonLabel>Reminder</IonLabel>
              </IonListHeader>
              <Stepper
                label="Backup reminder"
                noun="reminder days"
                unit=" days"
                value={settings.backupReminderDays}
                min={1}
                max={90}
                onChange={(days) => void setSetting(ctx, 'backupReminderDays', days)}
              />
            </IonList>
          )}

          <IonList inset>
            <IonListHeader>
              <IonLabel>This device</IonLabel>
            </IonListHeader>
            <IonItem>
              <IonLabel>Storage</IonLabel>
              <IonNote slot="end">{storageText(storage)}</IonNote>
            </IonItem>
            <IonItem>
              <IonLabel>Space used</IonLabel>
              <IonNote slot="end">{usageText(storage)}</IonNote>
            </IonItem>
            <IonItem>
              <IonLabel>App version</IonLabel>
              <IonNote slot="end">{version}</IonNote>
            </IonItem>
          </IonList>
        </>
      )}
    </PageShell>
  );
}
