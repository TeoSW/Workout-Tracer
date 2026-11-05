import { IonItem, IonLabel, IonList } from '@ionic/react';
import { PageShell } from '../../ui/PageShell';

export function ProgramsPage() {
  return (
    <PageShell title="Programs">
      <p className="empty-note">No programs yet.</p>
      <IonList inset>
        <IonItem routerLink="/tabs/programs/library" detail>
          <IonLabel>Exercises</IonLabel>
        </IonItem>
      </IonList>
    </PageShell>
  );
}
