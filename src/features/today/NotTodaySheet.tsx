import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonList,
  IonListHeader,
  IonLabel,
  IonModal,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useState } from 'react';
import { useData } from '../../app/DataProvider';
import { markDayMissed } from '../../data/missed-days';
import { MISSED_REASONS, type MissedReason } from '../../domain/schemas';
import { Chips } from '../../ui/Chips';
import { MISSED_REASON_LABELS } from '../../ui/labels';
import { ErrorNote, useGuard } from '../../ui/useGuard';

/** Asks why today is skipped, then records it. The reason and note are optional. */
export function NotTodaySheet(props: { open: boolean; dayName: string; onClose: () => void }) {
  const ctx = useData();
  const [reason, setReason] = useState<MissedReason | null>(null);
  const [note, setNote] = useState('');
  const { error, guard } = useGuard();

  function close() {
    setReason(null);
    setNote('');
    props.onClose();
  }

  return (
    <IonModal
      isOpen={props.open}
      breakpoints={[0, 0.6, 1]}
      initialBreakpoint={0.6}
      onDidDismiss={close}
    >
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={close}>Cancel</IonButton>
          </IonButtons>
          <IonTitle>Not today</IonTitle>
          <IonButtons slot="end">
            <IonButton
              strong
              onClick={() =>
                void guard(async () => {
                  await markDayMissed(ctx, { reason, note });
                  close();
                })
              }
            >
              Skip day
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <p className="section-note sheet-intro">{`${props.dayName} will be marked as missed and skipped. The plan stays as it is.`}</p>
        <IonList inset>
          <IonListHeader>
            <IonLabel>Reason</IonLabel>
          </IonListHeader>
          <Chips
            options={MISSED_REASONS}
            label={(r) => MISSED_REASON_LABELS[r]}
            isOn={(r) => r === reason}
            onTap={(r) => setReason(r === reason ? null : r)}
          />
          <IonItem>
            <IonTextarea
              aria-label="Note"
              placeholder="Note (optional)"
              autoGrow
              value={note}
              onIonInput={(e) => setNote(e.detail.value ?? '')}
            />
          </IonItem>
        </IonList>
        <ErrorNote error={error} />
      </IonContent>
    </IonModal>
  );
}
