import {
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
} from '@ionic/react';
import { archiveOutline } from 'ionicons/icons';
import { useState } from 'react';
import { useData, useLive } from '../../app/DataProvider';
import { addBand, archiveBand, listBands } from '../../data/bands';
import { PageShell } from '../../ui/PageShell';

export function BandsPage() {
  const ctx = useData();
  const bands = useLive(listBands);
  const [label, setLabel] = useState('');
  const [ratedKg, setRatedKg] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function add() {
    const kg = Number(ratedKg);
    if (label.trim() === '' || ratedKg === '' || !Number.isFinite(kg) || kg < 0) {
      setError('Give the band a name and a rated kg.');
      return;
    }
    await addBand(ctx, { label: label.trim(), ratedKg: kg });
    setLabel('');
    setRatedKg('');
    setError(null);
  }

  return (
    <PageShell title="Bands" back="/tabs/settings">
      <IonList inset>
        {bands?.map((band) => (
          <IonItem key={band.id}>
            <IonLabel>{band.label}</IonLabel>
            <IonNote slot="end">{band.ratedKg}kg</IonNote>
            <IonButton
              slot="end"
              fill="clear"
              color="medium"
              aria-label={`Archive ${band.label}`}
              onClick={() => void archiveBand(ctx, band.id)}
            >
              <IonIcon slot="icon-only" icon={archiveOutline} aria-hidden="true" />
            </IonButton>
          </IonItem>
        ))}
      </IonList>
      <p className="section-note">
        Band level is a resistance rating. Lower is harder, and it is never taken off bodyweight.
      </p>
      <IonList inset>
        <IonListHeader>
          <IonLabel>New band</IonLabel>
        </IonListHeader>
        <IonItem>
          <IonInput
            aria-label="New band name"
            placeholder="Name"
            value={label}
            onIonInput={(e) => setLabel(e.detail.value ?? '')}
          />
        </IonItem>
        <IonItem>
          <IonInput
            aria-label="New band rated kg"
            placeholder="Rated kg"
            inputmode="decimal"
            value={ratedKg}
            onIonInput={(e) => setRatedKg(e.detail.value ?? '')}
          />
        </IonItem>
        <IonItem button detail={false} onClick={() => void add()}>
          <IonLabel color="primary">Add band</IonLabel>
        </IonItem>
      </IonList>
      {error && (
        <p className="error-note" role="alert">
          {error}
        </p>
      )}
    </PageShell>
  );
}
