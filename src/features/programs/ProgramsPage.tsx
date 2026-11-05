import { IonBadge, IonButton, IonIcon, IonItem, IonLabel, IonList } from '@ionic/react';
import { add } from 'ionicons/icons';
import { useLive } from '../../app/DataProvider';
import { listPrograms } from '../../data/programs';
import { SPLIT_LABELS } from '../../ui/labels';
import { PageShell } from '../../ui/PageShell';

export function ProgramsPage() {
  const programs = useLive(listPrograms);

  return (
    <PageShell
      title="Programs"
      actions={
        <IonButton routerLink="/tabs/programs/new" aria-label="New program">
          <IonIcon slot="icon-only" icon={add} aria-hidden="true" />
        </IonButton>
      }
    >
      {programs?.length === 0 && <p className="empty-note">No programs yet.</p>}
      {programs && programs.length > 0 && (
        <IonList inset>
          {programs.map((p) => (
            <IonItem key={p.id} routerLink={`/tabs/programs/${p.id}`} detail>
              <IonLabel>
                <h2>{p.name}</h2>
                <p>{SPLIT_LABELS[p.splitType]}</p>
              </IonLabel>
              {p.active && (
                <IonBadge slot="end" color="success">
                  Active
                </IonBadge>
              )}
            </IonItem>
          ))}
        </IonList>
      )}
      <IonList inset>
        <IonItem routerLink="/tabs/programs/new" detail>
          <IonLabel>New program</IonLabel>
        </IonItem>
        <IonItem routerLink="/tabs/programs/import" detail>
          <IonLabel>Import program</IonLabel>
        </IonItem>
        <IonItem routerLink="/tabs/programs/library" detail>
          <IonLabel>Exercises</IonLabel>
        </IonItem>
      </IonList>
    </PageShell>
  );
}
